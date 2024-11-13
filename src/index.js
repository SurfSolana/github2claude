// src/index.js
import {
  fileURLToPath
} from 'url';
import {
  dirname,
  join
} from 'path';
import fs from 'fs/promises';
import simpleGit from 'simple-git';
import chalk from 'chalk';
import CodeAnalyzer from './code-analyzer.js';
import MarkdownGenerator from './markdown-generator.js';
import progress from './progress-util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const config = {
  tempDir: 'temp', // Will be relative to current working directory
  outputDir: '.', // Current directory
  markdownDir: 'claude-docs', // Subdirectory for markdown files
  textFileExtensions: [
    '.js', '.jsx', '.ts', '.tsx', '.md', '.txt', '.json',
    '.yml', '.yaml', '.css', '.scss', '.html', '.vue',
    '.py', '.rb', '.php', '.java', '.go', '.rs', '.sh'
  ],
  excludePatterns: [
    'node_modules', 'dist', 'build', 'coverage', '.git',
    '*.min.js', '*.bundle.js', '*.test.js', '*.spec.js'
  ],
  maxFileSize: 12000, // Characters per markdown file
  sectionsPerFile: 5, // Maximum number of code sections per file
};

function extractRepoInfo(url) {
  const parts = url.split('/');
  const username = parts[parts.length - 2];
  const repoWithGit = parts[parts.length - 1];
  const repoName = repoWithGit.replace('.git', '');
  return {
    username,
    repoName
  };
}

export async function executeCodeAnalysis(repoUrl) {
  const {
    username,
    repoName
  } = extractRepoInfo(repoUrl);
  const git = simpleGit();

  // Use current working directory 
  const cwd = process.cwd();
  const tempPath = join(cwd, config.tempDir, repoName);

  // Create directory name with username and repo
  const outputDirName = `g2c__${username}-${repoName}`;
  const outputPath = join(cwd, config.outputDir, outputDirName);

  try {
    progress.start('Repository Analysis');

    // Initialize directories
    progress.addSubtask('Creating directories');
    await fs.mkdir(join(cwd, config.tempDir), {
      recursive: true
    });
    await fs.mkdir(outputPath, {
      recursive: true
    });
    progress.completeSubtask('Creating directories');

    // Clone repository
    progress.addSubtask('Cloning repository');
    await git.clone(repoUrl, tempPath);
    progress.completeSubtask('Cloning repository');

    // Get version information
    progress.addSubtask('Getting version information');
    let version = 'latest';
    try {
      const packageJsonPath = join(tempPath, 'package.json');
      const packageJsonExists = await fs.access(packageJsonPath)
        .then(() => true)
        .catch(() => false);

      if (packageJsonExists) {
        const packageJson = JSON.parse(
          await fs.readFile(packageJsonPath, 'utf-8')
        );
        version = packageJson.version || 'latest';
      } else {
        // Try to get latest git tag
        const tags = await git.cwd(tempPath).tags();
        if (tags.latest) {
          version = tags.latest;
        }
      }
    } catch (error) {
      progress.warn('Could not determine version, using "latest"');
    }
    progress.completeSubtask('Getting version information');

    // Create final output path with version
    const versionedOutputPath = join(outputPath, version);
    await fs.mkdir(versionedOutputPath, {
      recursive: true
    });

    // Scan repository
    progress.addSubtask('Scanning files');
    const files = await scanDirectory(tempPath);
    progress.completeSubtask('Scanning files');

    // Generate documentation
    progress.addSubtask('Generating documentation');
    await generateMarkdownFiles(files, repoName, tempPath, versionedOutputPath, {
      username,
      version
    });
    progress.completeSubtask('Generating documentation');

    progress.finish();
    console.log(chalk.green(`\nDocumentation generated in: ${versionedOutputPath}`));
  } catch (error) {
    progress.error('Analysis failed');
    throw error;
  } finally {
    // Cleanup temp directory only
    try {
      progress.addSubtask('Cleaning up');
      await fs.rm(join(cwd, config.tempDir), {
        recursive: true,
        force: true
      });
      progress.completeSubtask('Cleaning up');
    } catch (error) {
      progress.warn('Cleanup failed');
    }
  }
}

async function scanDirectory(dir) {
  const files = await fs.readdir(dir, {
    withFileTypes: true
  });
  const results = [];

  for (const file of files) {
    const fullPath = join(dir, file.name);
    if (file.isDirectory()) {
      if (!config.excludePatterns.includes(file.name)) {
        results.push(...await scanDirectory(fullPath));
      }
    } else if (config.textFileExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
      results.push(fullPath);
    }
  }

  return results;
}

async function generateMarkdownFiles(files, repoName, tempPath, outputPath, info) {
  const {
    username,
    version
  } = info;
  const repoFullName = `${username}--${repoName}@${version}`;
  const analyzer = new CodeAnalyzer();
  const analyses = new Map();

  // Analyze files
  progress.addSubtask('Analyzing files');
  for (const [index, file] of files.entries()) {
    try {
      progress.update('Analyzing files', index + 1, files.length);
      const analysis = await analyzer.analyzeFile(file);
      analyses.set(file, analysis);
    } catch (error) {
      progress.warn(`Could not analyze ${file}`);
    }
  }
  progress.completeSubtask('Analyzing files');

  // Build dependency graph
  progress.addSubtask('Building dependency graph');
  const dependencyGraph = await analyzer.buildDependencyGraph(analyses);
  progress.completeSubtask('Building dependency graph');

  // Generate content sections
  progress.addSubtask('Generating content sections');
  const generator = new MarkdownGenerator(repoName, tempPath);
  const sections = await generator.generateSections(files, analyses, dependencyGraph);
  progress.completeSubtask('Generating content sections');

  // Create index file
  progress.addSubtask('Creating documentation files');
  const indexContent = await generator.generateIndex(sections, repoFullName);
  await fs.writeFile(join(outputPath, `${repoFullName}__README.md`), indexContent);

  // Generate meaningful names for sections
  const sectionFiles = sections.map(section => {
    const titleMatch = section.match(/^## [^#\n]*/m);
    if (titleMatch) {
      const title = titleMatch[0].replace('## ', '').trim();
      const sanitizedTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return {
        content: section,
        filename: `${sanitizedTitle}.md`
      };
    }
    return {
      content: section,
      filename: `part-${String(sections.indexOf(section) + 1).padStart(2, '0')}.md`
    };
  });

  // Write section files
  for (const [index, section] of sectionFiles.entries()) {
    progress.update('Writing documentation files', index + 1, sectionFiles.length);
    const filePath = join(outputPath, section.filename);
    await fs.writeFile(filePath, section.content);
  }
  progress.completeSubtask('Creating documentation files');
}

export {
  CodeAnalyzer,
  MarkdownGenerator
};