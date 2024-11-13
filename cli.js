#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import { executeCodeAnalysis } from './src/index.js';
import progress from './src/progress-util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const showHelp = () => {
    console.log(`
${chalk.bold('GitHub to Claude Code Mapper')}

${chalk.cyan('Description:')}
  Generates AI-optimized documentation from GitHub repositories for use with Claude.
  Creates a directory of markdown files, each sized appropriately for LLM processing.

${chalk.cyan('Usage:')}
  ${chalk.yellow('npx github2claude')} ${chalk.green('<repository-url>')}

${chalk.cyan('Example:')}
  ${chalk.yellow('npx github2claude')} ${chalk.green('https://github.com/username/repository')}

${chalk.cyan('Output:')}
  Creates a 'username__repository@version' directory in your current location
  containing markdown files optimized for uploading to Claude.

${chalk.cyan('Options:')}
  -h, --help     Show this help message
  -v, --version  Show version number

For more information, visit: ${chalk.blue('https://github.com/SurfSolana/github-to-claude')}
`);
};

const showVersion = async () => {
    try {
        const packageJson = JSON.parse(
            await fs.readFile(join(__dirname, 'package.json'), 'utf-8')
        );
        console.log(`v${packageJson.version}`);
    } catch (error) {
        console.error(chalk.red('Error reading version information'));
        process.exit(1);
    }
};

const main = async () => {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        showHelp();
        process.exit(0);
    }

    if (args.includes('-v') || args.includes('--version')) {
        await showVersion();
        process.exit(0);
    }

    const repoUrl = args[0];

    if (!repoUrl.startsWith('https://github.com/')) {
        console.error(chalk.red('Error: Please provide a valid GitHub repository URL'));
        console.error(chalk.yellow('Example: https://github.com/username/repository'));
        process.exit(1);
    }

    try {
        await executeCodeAnalysis(repoUrl);
    } catch (error) {
        progress.error('Execution failed');
        console.error(chalk.red(error.message));
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    progress.error('Unexpected error');
    console.error(chalk.red(error.message));
    process.exit(1);
});

main().catch(error => {
    progress.error('Fatal error');
    console.error(chalk.red(error.message));
    process.exit(1);
});