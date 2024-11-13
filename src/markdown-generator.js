// src/markdown-generator.js
import fs from 'fs/promises';
import path from 'path';
import progress from './progress-util.js';

class MarkdownGenerator {
    constructor(repoName, basePath) {
        this.repoName = repoName;
        this.basePath = basePath;
        this.content = [];
        this.treeContent = [];
        this.componentMap = new Map();
    }

    async generateSections(files, analyses, dependencyGraph) {
        const sections = [];

        try {
            // Add overview section
            progress.addSubtask('Generating overview');
            sections.push(await this.generateOverviewSection());
            progress.completeSubtask('Generating overview');

            // Add architecture section
            progress.addSubtask('Analyzing architecture');
            sections.push(await this.generateArchitectureSection(analyses, dependencyGraph));
            progress.completeSubtask('Analyzing architecture');

            // Group files by directory
            const filesByDirectory = this.groupFilesByDirectory(files);

            // Generate sections for each directory
            progress.addSubtask('Processing directories');
            let dirCount = 0;
            for (const [directory, directoryFiles] of filesByDirectory) {
                progress.update('Processing directories', ++dirCount, filesByDirectory.size);
                sections.push(await this.generateDirectorySection(directory, directoryFiles, analyses, dependencyGraph));
            }
            progress.completeSubtask('Processing directories');

            return sections;
        } catch (error) {
            progress.error(`Error generating sections: ${error.message}`);
            throw error;
        }
    }

    async generateOverviewSection() {
        return `# ${this.repoName} Code Documentation

<repository_overview>
Repository Name: ${this.repoName}
Analysis Date: ${new Date().toISOString()}
Analysis Type: LLM-Optimized Documentation

## Purpose
This documentation is organized to provide a clear understanding of the codebase structure, 
relationships between components, and implementation details. Each section is sized 
appropriately for processing with Large Language Models like Claude.

## Documentation Structure
- Overview and Introduction
- Architecture and Dependencies
- Directory-based Code Analysis
- Component Relationships
- Implementation Details
</repository_overview>
`;
    }

    async generateArchitectureSection(analyses, dependencyGraph) {
        const components = await this.identifyMainComponents(analyses);
        const flows = await this.analyzeDataFlows(dependencyGraph);
        const dependencies = await this.analyzeKeyDependencies(dependencyGraph);

        return `## Architecture Overview

<architecture_analysis>
### Core Components
${components.map(comp => `- ${comp.name}: ${comp.description}`).join('\n')}

### Data Flow Patterns
${flows.map(flow => `- ${flow}`).join('\n')}

### Key Dependencies
${dependencies}
</architecture_analysis>
`;
    }

    async generateDirectorySection(directory, files, analyses, dependencyGraph) {
        const relativePath = path.relative(this.basePath, directory);
        let section = `## Directory: ${relativePath || 'Root'}

<directory_analysis>
This directory contains ${files.length} file(s).\n\n`;

        for (const file of files) {
            const analysis = analyses.get(file);
            const deps = dependencyGraph.get(file);
            if (analysis) {
                section += await this.formatFileSection(file, analysis, deps);
            }
        }

        section += '</directory_analysis>';
        return section;
    }

    async generateIndex(sections, repoFullName) {
        return `# ${repoFullName} Documentation Index

<documentation_index>
## Overview
This documentation is split into ${sections.length} files for optimal processing with AI models.

## Files
${sections.map((section, index) => {
    const titleMatch = section.match(/^## [^#\n]*/m);
    const title = titleMatch ? titleMatch[0].replace('## ', '').trim() : `Part ${index + 1}`;
    const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${index + 1}. ${sanitizedTitle}.md - ${title}`;
}).join('\n')}

## Usage Guide
1. Start with this index file to understand the documentation structure
2. Each file contains a logical section of the codebase:
   ${sections.map((section, index) => {
       const titleMatch = section.match(/^## [^#\n]*/m);
       const title = titleMatch ? titleMatch[0].replace('## ', '').trim() : `Part ${index + 1}`;
       return `\n   - ${title}`;
   }).join('')}
3. Files are sized appropriately for AI processing
4. Cross-references between files are maintained using relative links

## Documentation Features
- Comprehensive code analysis
- Dependency mapping
- Component relationships
- Implementation details
- Directory-based organization
</documentation_index>
`;
    }

    async formatFileSection(filePath, analysis, deps) {
        const relativePath = path.relative(this.basePath, filePath);
        const extension = path.extname(filePath).substring(1);

        let section = `### File: ${relativePath}\n\n`;
        section += '<file_analysis>\n';
        
        // Add file purpose
        section += await this.inferFilePurpose(filePath, analysis);
        
        // Add dependencies
        if (deps && deps.dependencies.length > 0) {
            section += '\nDependencies:\n';
            section += deps.dependencies.map(d => `- ${d}`).join('\n') + '\n';
        }

        // Add exports
        if (analysis.exports && analysis.exports.length > 0) {
            section += '\nExports:\n';
            section += analysis.exports.map(e => `- ${e.type}: ${e.name}`).join('\n') + '\n';
        }

        // Add interfaces/types for TypeScript
        if (analysis.interfaces) {
            section += '\nInterfaces:\n';
            section += analysis.interfaces.map(i => `- ${i.name}`).join('\n') + '\n';
        }

        // Add functions/classes
        if (analysis.functions && analysis.functions.length > 0) {
            section += '\nFunctions:\n';
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

        section += '</file_analysis>\n\n';

        // Add the actual code
        section += '<file_code>\n';
        section += '```' + extension + '\n';
        section += analysis.content;
        section += '\n```\n';
        section += '</file_code>\n\n';

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

    groupFilesByDirectory(files) {
        const groups = new Map();
        
        for (const file of files) {
            const directory = path.dirname(file);
            if (!groups.has(directory)) {
                groups.set(directory, []);
            }
            groups.get(directory).push(file);
        }

        return groups;
    }

    async identifyMainComponents(analyses) {
        const componentScores = new Map();

        if (!analyses) return [];

        for (const analysis of analyses.values()) {
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

        for (const [file, _] of dependencyGraph.entries()) {
            if (!visited.has(file)) {
                const chain = await this.findLongestDependencyChain(file, dependencyGraph, new Set());
                if (chain.length > 1) {
                    flows.push(`${chain.map(f => path.basename(f)).join(' → ')}`);
                }
                chain.forEach(f => visited.add(f));
            }
        }

        return flows.slice(0, 5); // Return top 5 flows
    }

    async findLongestDependencyChain(file, graph, visited) {
        if (visited.has(file)) return [];
        visited.add(file);

        const deps = graph.get(file)?.dependencies || [];
        let longestChain = [file];

        for (const dep of deps) {
            const chain = await this.findLongestDependencyChain(dep, graph, new Set(visited));
            if (chain.length + 1 > longestChain.length) {
                longestChain = [file, ...chain];
            }
        }

        return longestChain;
    }

    async analyzeKeyDependencies(dependencyGraph) {
        const dependencyCounts = new Map();

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
    }
}

export default MarkdownGenerator;