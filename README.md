# GitHub to Claude Code Mapper

A Node.js tool that downloads GitHub repositories and generates LLM-optimized markdown documentation for easy code understanding with Claude and other AI assistants.

## Overview

This tool is designed to:
1. Clone GitHub repositories
2. Analyze the codebase structure and relationships
3. Generate a comprehensive markdown document optimized for Large Language Models
4. Package the code in a format that's ideal for uploading to Claude conversations

## Features

- 🔍 Automatic code analysis and structure mapping
- 📊 Dependency relationship tracking
- 🗺️ Visual directory structure representation
- 💡 Intelligent component identification
- 🔗 Data flow visualization
- 📝 LLM-optimized markdown output
- 🎯 Special XML-style tags for better AI comprehension

## Installation

```bash
# Clone the repository
git clone https://github.com/SurfSolana/github-to-claude.git

# Enter the directory
cd github-to-claude

# Install dependencies
pnpm i

# global usage
npm link
```

## Usage

```bash
github2claude https://github.com/username/repository
```

The tool will:
1. Clone the specified repository
2. Analyze its structure
3. Generate markdown files in the `claude-docs` directory

## Output Format

The generated markdown includes:
- Repository metadata
- Project structure overview
- Directory tree
- Architecture analysis
- Component relationships
- Detailed code sections with analysis

Each section is wrapped in special tags for better AI comprehension:
```markdown
<codebase_metadata>
Repository information
</codebase_metadata>

<project_structure>
Directory and component organization
</project_structure>

<architecture_analysis>
System design and relationships
</architecture_analysis>

<component_analysis>
Individual file analysis
</component_analysis>
```

## Supported File Types

- JavaScript (.js, .jsx)
- TypeScript (.ts, .tsx)
- HTML/CSS
- Markdown
- YAML/JSON
- And many other text-based file formats

## Configuration

The tool can be configured by modifying the `config` object in `index.js`:

```javascript
const config = {
    tempDir: 'temp',
    outputDir: 'output',
    textFileExtensions: [...],
    excludePatterns: [...]
};
```

## Error Handling

The tool includes robust error handling for:
- Repository access issues
- File parsing errors
- TypeScript/JavaScript analysis
- Dependency resolution
- File system operations

## Requirements

- Node.js >=16
- NPM or Yarn
- Git installed on your system

## Dependencies

- @babel/parser: Code parsing
- @babel/traverse: AST traversal
- @typescript-eslint/parser: TypeScript parsing
- simple-git: Git operations
- chalk: Terminal coloring

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this in your own projects!

## Acknowledgments

This tool is designed specifically for use with Anthropic's Claude AI assistant, but can be used with other AI systems that process markdown.

## Common Issues

### TypeScript Version Warning
If you see TypeScript version warnings, you can install a compatible version:
```bash
npm install typescript@~5.3.3
```

### Parsing Errors
Some TypeScript files might show parsing warnings. These are handled gracefully and won't affect the overall output.

## Future Improvements

- [ ] Support for more programming languages
- [ ] Enhanced relationship mapping
- [ ] Custom tag system for different AI models
- [ ] Interactive mode
- [ ] Configuration file support
- [ ] Plugin system for custom analyzers