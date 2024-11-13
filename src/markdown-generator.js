// src/markdown-generator.js
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

class MarkdownGenerator {
    constructor(repoName, basePath) {
        this.repoName = repoName;
        this.basePath = basePath;
        this.content = [];
        this.treeContent = [];
        this.componentMap = new Map();
    }

    async generateMarkdown(files, analyses, dependencyGraph) {
        try {
            this.addHeader();
            await this.addProjectOverview();
            await this.generateDirectoryTree('');
            await this.addArchitectureSection(analyses, dependencyGraph);
            await this.addCodeSections(files, analyses, dependencyGraph);
            return this.content.join('\n\n');
        } catch (error) {
            console.error(chalk.red('Error generating markdown:'), error);
            throw error;
        }
    }

    addHeader() {
        this.content.push(`# ${this.repoName} Codebase Map

<codebase_metadata>
Repository Name: ${this.repoName}
Analysis Date: ${new Date().toISOString()}
Analysis Type: LLM-Optimized Code Map
</codebase_metadata>
`);
    }

    async addProjectOverview() {
        try {
            const entryPoints = await this.findEntryPoints();
            const languages = await this.detectLanguages();
            const mainComponents = await this.identifyMainComponents();

            this.content.push(`## Project Overview

<project_structure>
Primary Languages: ${languages.join(', ')}
Entry Points: ${entryPoints.map(ep => `\`${ep}\``).join(', ')}
Main Components: ${mainComponents.map(comp => `\`${comp}\``).join(', ')}

### Architectural Summary
This codebase map is organized to provide a clear understanding of:
1. Directory structure and file organization
2. Component relationships and dependencies
3. Core functionality and business logic
4. Entry points and data flow
</project_structure>
`);
        } catch (error) {
            console.warn(chalk.yellow('Warning: Error generating project overview:'), error);
            // Add a basic overview if detailed analysis fails
            this.content.push(`## Project Overview\n\nBasic repository analysis for ${this.repoName}\n`);
        }
    }

    async generateDirectoryTree(currentPath) {
        try {
            const fullPath = path.join(this.basePath, currentPath);
            const entries = await fs.readdir(fullPath, { withFileTypes: true });
            let prefix = currentPath === '' ? '' : '  '.repeat(currentPath.split('/').length);

            for (const entry of entries) {
                if (this.shouldIgnore(entry.name)) continue;

                if (entry.isDirectory()) {
                    this.treeContent.push(`${prefix}${entry.name}/`);
                    await this.generateDirectoryTree(path.join(currentPath, entry.name));
                } else {
                    this.treeContent.push(`${prefix}${entry.name}`);
                }
            }

            if (currentPath === '') {
                this.content.push(`## Directory Structure

<directory_structure>
\`\`\`
${this.treeContent.join('\n')}
\`\`\`
</directory_structure>
`);
            }
        } catch (error) {
            console.warn(chalk.yellow('Warning: Error generating directory tree:'), error);
        }
    }

    async addArchitectureSection(analyses, dependencyGraph) {
        try {
            const components = await this.identifyMainComponents(analyses);
            const flows = await this.analyzeDataFlows(dependencyGraph);

            this.content.push(`## Architecture Overview

<architecture_analysis>
### Core Components
${components.map(comp => `- ${comp.name}: ${comp.description}`).join('\n')}

### Data Flow Patterns
${flows.map(flow => `- ${flow}`).join('\n')}

### Key Dependencies
${await this.analyzeKeyDependencies(dependencyGraph)}
</architecture_analysis>
`);
        } catch (error) {
            console.warn(chalk.yellow('Warning: Error generating architecture section:'), error);
        }
    }

    async addCodeSections(files, analyses, dependencyGraph) {
        this.content.push('## Code Components\n');

        for (const file of files) {
            try {
                const relativePath = path.relative(this.basePath, file);
                const analysis = analyses.get(file);
                const deps = dependencyGraph.get(file);

                if (!analysis) continue;

                const section = await this.formatCodeSection(relativePath, analysis, deps);
                this.content.push(section);
            } catch (error) {
                console.warn(chalk.yellow(`Warning: Error processing file ${file}:`), error);
            }
        }
    }

    async formatCodeSection(filePath, analysis, deps) {
        const fileContent = analysis.content;
        const extension = path.extname(filePath).substring(1);

        let section = `### File: ${filePath}\n\n`;
        section += '<component_analysis>\n';
        
        // Add file purpose and role
        section += await this.inferFilePurpose(filePath, analysis);
        
        // Add dependencies information
        if (deps && deps.dependencies.length > 0) {
            section += '\nDependencies:\n';
            section += deps.dependencies.map(d => `- ${d}`).join('\n') + '\n';
        }

        // Add exports information
        if (analysis.exports && analysis.exports.length > 0) {
            section += '\nExports:\n';
            section += analysis.exports.map(e => `- ${e.type}: ${e.name}`).join('\n') + '\n';
        }

        // Add interfaces/types for TypeScript files
        if (analysis.interfaces) {
            section += '\nInterfaces:\n';
            section += analysis.interfaces.map(i => `- ${i.name}`).join('\n') + '\n';
        }

        // Add functions/classes information with descriptions
        if (analysis.functions && analysis.functions.length > 0) {
            section += '\nKey Functions:\n';
            section += analysis.functions.map(f => {
                const params = f.params.join(', ');
                return `- ${f.name}(${params})${f.async ? ' [async]' : ''}`;
            }).join('\n') + '\n';
        }

        if (analysis.classes && analysis.classes.length > 0) {
            section += '\nClasses:\n';
            section += analysis.classes.map(c => {
                let classDesc = `- ${c.name}`;
                if (c.superClass) classDesc += ` extends ${c.superClass}`;
                if (c.methods && c.methods.length > 0) {
                    classDesc += '\n  Methods:\n';
                    classDesc += c.methods.map(m => 
                        `  - ${m.name}${m.static ? ' [static]' : ''}${m.async ? ' [async]' : ''}`
                    ).join('\n');
                }
                return classDesc;
            }).join('\n') + '\n';
        }

        section += '</component_analysis>\n\n';

        // Add the actual code with language marker
        section += '<component_code>\n';
        section += '```' + extension + '\n';
        section += fileContent;
        section += '\n```\n';
        section += '</component_code>\n';

        return section;
    }

    async inferFilePurpose(filePath, analysis) {
        const filename = path.basename(filePath).toLowerCase();
        let purpose = '\nFile Purpose: ';

        if (filename.includes('index')) {
            purpose += 'Entry point / Module exports';
        } else if (filename.includes('types') || filename.includes('.d.ts')) {
            purpose += 'Type definitions';
        } else if (filename.includes('utils') || filename.includes('helpers')) {
            purpose += 'Utility functions';
        } else if (filename.includes('component')) {
            purpose += 'UI Component';
        } else if (filename.includes('service')) {
            purpose += 'Service layer';
        } else if (analysis.classes && analysis.classes.length > 0) {
            purpose += 'Class implementation';
        } else if (analysis.functions && analysis.functions.length > 0) {
            purpose += 'Function implementations';
        } else {
            purpose += 'Supporting module';
        }

        return purpose + '\n';
    }

    shouldIgnore(name) {
        const ignorePatterns = [
            'node_modules', '.git', 'build', 'dist',
            /^\..+/, // Hidden files and directories
            /\.(log|pid|lock)$/
        ];

        return ignorePatterns.some(pattern => 
            pattern instanceof RegExp ? 
                pattern.test(name) : 
                name === pattern
        );
    }

    async findEntryPoints() {
        const entryPatterns = [
            'index.js', 'main.js', 'app.js',
            'index.ts', 'main.ts', 'app.ts',
            'package.json'
        ];

        const entryPoints = [];
        
        try {
            const files = await this.scanDirectory(this.basePath);
            for (const file of files) {
                const basename = path.basename(file);
                if (entryPatterns.includes(basename)) {
                    entryPoints.push(path.relative(this.basePath, file));
                }
            }
        } catch (error) {
            console.warn(chalk.yellow('Warning: Error finding entry points:'), error);
        }

        return entryPoints;
    }

    async scanDirectory(dir) {
        const results = [];
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                if (this.shouldIgnore(entry.name)) continue;

                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    results.push(...await this.scanDirectory(fullPath));
                } else {
                    results.push(fullPath);
                }
            }
        } catch (error) {
            console.warn(chalk.yellow(`Warning: Error scanning directory ${dir}:`), error);
        }

        return results;
    }

    async detectLanguages() {
        const extensions = new Set();
        
        try {
            const files = await this.scanDirectory(this.basePath);
            for (const file of files) {
                const ext = path.extname(file);
                if (ext) {
                    extensions.add(ext.substring(1));
                }
            }
        } catch (error) {
            console.warn(chalk.yellow('Warning: Error detecting languages:'), error);
        }

        return Array.from(extensions);
    }

    async identifyMainComponents(analyses) {
        const componentScores = new Map();

        if (!analyses) return [];

        for (const [file, analysis] of analyses.entries()) {
            if (analysis.exports && analysis.exports.length > 0) {
                for (const exp of analysis.exports) {
                    const score = componentScores.get(exp.name) || 0;
                    componentScores.set(exp.name, score + 1);
                }
            }
        }

        return Array.from(componentScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, score]) => ({
                name,
                description: `Core component (referenced ${score} times)`
            }));
    }

    async analyzeDataFlows(dependencyGraph) {
        const flows = [];
        const visited = new Set();

        try {
            for (const [file, deps] of dependencyGraph.entries()) {
                if (!visited.has(file)) {
                    const chain = await this.findLongestDependencyChain(file, dependencyGraph, new Set());
                    if (chain.length > 1) {
                        flows.push(`${chain.map(f => path.basename(f)).join(' → ')}`);
                    }
                    chain.forEach(f => visited.add(f));
                }
            }
        } catch (error) {
            console.warn(chalk.yellow('Warning: Error analyzing data flows:'), error);
        }

        return flows.slice(0, 5); // Return top 5 flows for clarity
    }

    async findLongestDependencyChain(file, graph, visited) {
        if (visited.has(file)) return [];
        visited.add(file);

        try {
            const deps = graph.get(file)?.dependencies || [];
            let longestChain = [file];

            for (const dep of deps) {
                const chain = await this.findLongestDependencyChain(dep, graph, new Set(visited));
                if (chain.length + 1 > longestChain.length) {
                    longestChain = [file, ...chain];
                }
            }

            return longestChain;
        } catch (error) {
            console.warn(chalk.yellow(`Warning: Error finding dependency chain for ${file}:`), error);
            return [file];
        }
    }

    async analyzeKeyDependencies(dependencyGraph) {
        const dependencyCounts = new Map();

        try {
            for (const [_, deps] of dependencyGraph.entries()) {
                for (const dep of deps.dependencies) {
                    const count = dependencyCounts.get(dep) || 0;
                    dependencyCounts.set(dep, count + 1);
                }
            }

            return Array.from(dependencyCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([dep, count]) => `- ${dep}: Referenced ${count} times`)
                .join('\n');
        } catch (error) {
            console.warn(chalk.yellow('Warning: Error analyzing key dependencies:'), error);
            return 'No dependency information available';
        }
    }
}

export default MarkdownGenerator;