// index.js
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import simpleGit from 'simple-git';
import chalk from 'chalk';
import CodeAnalyzer from './src/code-analyzer.js';
import MarkdownGenerator from './src/markdown-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const config = {
    tempDir: join(__dirname, 'temp'),
    outputDir: join(__dirname, 'output'),
    textFileExtensions: [
        '.js', '.jsx', '.ts', '.tsx', '.md', '.txt', '.json', 
        '.yml', '.yaml', '.css', '.scss', '.html', '.vue', 
        '.py', '.rb', '.php', '.java', '.go', '.rs', '.sh'
    ],
    excludePatterns: [
        'node_modules', 'dist', 'build', 'coverage', '.git',
        '*.min.js', '*.bundle.js', '*.test.js', '*.spec.js'
    ]
};

class CodebaseMapper {
    constructor(repoUrl) {
        this.repoUrl = repoUrl;
        this.repoName = this.extractRepoName(repoUrl);
        this.git = simpleGit();
        this.tempPath = join(config.tempDir, this.repoName);
        this.outputPath = join(config.outputDir, `${this.repoName}-map.md`);
    }

    extractRepoName(url) {
        const parts = url.split('/');
        return parts[parts.length - 1].replace('.git', '');
    }

    async initialize() {
        try {
            await fs.mkdir(config.tempDir, { recursive: true });
            await fs.mkdir(config.outputDir, { recursive: true });
        } catch (error) {
            console.error(chalk.red('Error initializing directories:'), error);
            throw error;
        }
    }

    async downloadRepo() {
        try {
            console.log(chalk.blue(`Cloning repository: ${this.repoUrl}`));
            await this.git.clone(this.repoUrl, this.tempPath);
            console.log(chalk.green('Repository cloned successfully'));
        } catch (error) {
            console.error(chalk.red('Error cloning repository:'), error);
            throw error;
        }
    }

    async cleanup() {
        try {
            await fs.rm(this.tempPath, { recursive: true, force: true });
            console.log(chalk.yellow('Cleaned up temporary files'));
        } catch (error) {
            console.warn(chalk.yellow('Warning during cleanup:'), error);
        }
    }

    isTextFile(filePath) {
        return config.textFileExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
    }

    shouldIncludeFile(filePath) {
        return !config.excludePatterns.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace('*', '.*'));
                return regex.test(filePath);
            }
            return filePath.includes(pattern);
        });
    }

    async scanDirectory(dir) {
        const files = await fs.readdir(dir, { withFileTypes: true });
        const results = [];

        for (const file of files) {
            const fullPath = join(dir, file.name);
            if (file.isDirectory()) {
                if (this.shouldIncludeFile(file.name)) {
                    results.push(...await this.scanDirectory(fullPath));
                }
            } else if (this.isTextFile(file.name) && this.shouldIncludeFile(file.name)) {
                results.push(fullPath);
            }
        }

        return results;
    }

    async generateMarkdown(files) {
        const analyzer = new CodeAnalyzer();
        const analyses = new Map();

        console.log(chalk.blue('Analyzing files...'));
        // Analyze all files
        for (const file of files) {
            try {
                const analysis = await analyzer.analyzeFile(file);
                analyses.set(file, analysis);
            } catch (error) {
                console.warn(chalk.yellow(`Warning: Could not analyze ${file}:`), error);
            }
        }

        try {
            // Build dependency graph
            const dependencyGraph = await analyzer.buildDependencyGraph(analyses);

            // Generate markdown
            const generator = new MarkdownGenerator(this.repoName, this.tempPath);
            const markdown = await generator.generateMarkdown(files, analyses, dependencyGraph);

            // Write to file
            await fs.writeFile(this.outputPath, markdown, 'utf-8');
        } catch (error) {
            console.error(chalk.red('Error generating markdown:'), error);
            throw error;
        }
    }

    // Main execution method
    async execute() {
        try {
            await this.initialize();
            await this.downloadRepo();
            
            console.log(chalk.blue('Scanning repository...'));
            const files = await this.scanDirectory(this.tempPath);
            
            console.log(chalk.blue('Generating markdown...'));
            await this.generateMarkdown(files);
            
            console.log(chalk.green(`Markdown generated at: ${this.outputPath}`));
        } catch (error) {
            console.error(chalk.red('Error during execution:'), error);
            throw error;
        } finally {
            await this.cleanup();
        }
    }
}

// CLI handling
const main = async () => {
    if (process.argv.length < 3) {
        console.error(chalk.red('Please provide a GitHub repository URL'));
        process.exit(1);
    }

    const repoUrl = process.argv[2];
    const mapper = new CodebaseMapper(repoUrl);
    
    try {
        await mapper.execute();
    } catch (error) {
        console.error(chalk.red('Fatal error:'), error);
        process.exit(1);
    }
};

main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
});