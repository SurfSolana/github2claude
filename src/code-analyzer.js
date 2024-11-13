// src/code-analyzer.js
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as babelParser from '@babel/parser';
import traverse from '@babel/traverse';
import { parse as parseTypeScript } from '@typescript-eslint/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CodeAnalyzer {
    constructor() {
        this.dependencies = new Map();
        this.exports = new Map();
        this.functionDetails = new Map();
    }

    async analyzeFile(filePath) {
        try {
            const content = await fsPromises.readFile(filePath, 'utf-8');
            const ext = filePath.split('.').pop()?.toLowerCase();
            
            switch (ext) {
                case 'js':
                case 'jsx':
                    return this.analyzeJavaScript(content, filePath);
                case 'ts':
                case 'tsx':
                    return this.analyzeTypeScript(content, filePath);
                default:
                    return this.analyzeGenericFile(content, filePath);
            }
        } catch (error) {
            console.warn(`Warning: Could not analyze ${filePath}:`, error);
            return {
                imports: [],
                exports: [],
                functions: [],
                content: ''
            };
        }
    }

    analyzeJavaScript(content, filePath) {
        try {
            const ast = babelParser.parse(content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript', 'decorators-legacy'],
                tokens: true,
                errorRecovery: true,
            });

            const analysis = {
                imports: [],
                exports: [],
                functions: [],
                classes: [],
                content
            };

            traverse.default(ast, {
                ImportDeclaration: path => {
                    try {
                        analysis.imports.push({
                            source: path.node.source.value,
                            specifiers: path.node.specifiers.map(spec => spec.local.name)
                        });
                    } catch (e) {
                        // Skip problematic import
                    }
                },

                ExportNamedDeclaration: path => {
                    try {
                        if (path.node.declaration) {
                            if (path.node.declaration.declarations) {
                                path.node.declaration.declarations.forEach(declaration => {
                                    analysis.exports.push({
                                        type: 'named',
                                        name: declaration.id.name
                                    });
                                });
                            } else if (path.node.declaration.id) {
                                analysis.exports.push({
                                    type: 'named',
                                    name: path.node.declaration.id.name
                                });
                            }
                        } else if (path.node.specifiers) {
                            path.node.specifiers.forEach(specifier => {
                                analysis.exports.push({
                                    type: 'named',
                                    name: specifier.exported.name
                                });
                            });
                        }
                    } catch (e) {
                        // Skip problematic export
                    }
                },

                ExportDefaultDeclaration: path => {
                    try {
                        let name = 'default';
                        if (path.node.declaration.name) {
                            name = path.node.declaration.name;
                        } else if (path.node.declaration.id) {
                            name = path.node.declaration.id.name;
                        }
                        analysis.exports.push({
                            type: 'default',
                            name
                        });
                    } catch (e) {
                        // Skip problematic export
                    }
                },

                FunctionDeclaration: path => {
                    try {
                        analysis.functions.push({
                            name: path.node.id.name,
                            params: path.node.params.map(p => p.name || 'unnamed'),
                            async: path.node.async,
                            generator: path.node.generator,
                            loc: path.node.loc
                        });
                    } catch (e) {
                        // Skip problematic function
                    }
                },

                ClassDeclaration: path => {
                    try {
                        const classInfo = {
                            name: path.node.id.name,
                            superClass: path.node.superClass?.name,
                            methods: path.node.body.body
                                .filter(node => node.type === 'ClassMethod')
                                .map(node => ({
                                    name: node.key.name,
                                    kind: node.kind,
                                    static: node.static,
                                    async: node.async,
                                    params: node.params.map(p => p.name || 'unnamed')
                                }))
                        };
                        analysis.classes.push(classInfo);
                    } catch (e) {
                        // Skip problematic class
                    }
                }
            });

            return analysis;
        } catch (error) {
            console.warn(`Warning: Error parsing JavaScript ${filePath}:`, error);
            return {
                imports: [],
                exports: [],
                functions: [],
                classes: [],
                content
            };
        }
    }

    analyzeTypeScript(content, filePath) {
        try {
            // First try parsing with babel parser as a fallback
            const ast = babelParser.parse(content, {
                sourceType: 'module',
                plugins: ['typescript', 'jsx'],
                tokens: true,
                errorRecovery: true,
            });

            const analysis = {
                imports: [],
                exports: [],
                interfaces: [],
                types: [],
                content
            };

            traverse.default(ast, {
                ImportDeclaration: path => {
                    try {
                        analysis.imports.push({
                            source: path.node.source.value,
                            specifiers: path.node.specifiers.map(spec => spec.local.name)
                        });
                    } catch (e) {
                        // Skip problematic import
                    }
                },

                ExportNamedDeclaration: path => {
                    try {
                        if (path.node.declaration) {
                            if (path.node.declaration.declarations) {
                                path.node.declaration.declarations.forEach(declaration => {
                                    analysis.exports.push({
                                        type: 'named',
                                        name: declaration.id.name
                                    });
                                });
                            } else if (path.node.declaration.id) {
                                analysis.exports.push({
                                    type: 'named',
                                    name: path.node.declaration.id.name
                                });
                            }
                        }
                    } catch (e) {
                        // Skip problematic export
                    }
                },

                TSInterfaceDeclaration: path => {
                    try {
                        analysis.interfaces.push({
                            name: path.node.id.name,
                            properties: path.node.body.body.map(prop => ({
                                name: prop.key?.name || 'unknown',
                                type: this.getTypeScriptType(prop.typeAnnotation) || 'any'
                            }))
                        });
                    } catch (e) {
                        // Skip problematic interface
                    }
                },

                TSTypeAliasDeclaration: path => {
                    try {
                        analysis.types.push({
                            name: path.node.id.name,
                            type: this.getTypeScriptType(path.node.typeAnnotation) || 'any'
                        });
                    } catch (e) {
                        // Skip problematic type
                    }
                }
            });

            return analysis;
        } catch (error) {
            console.warn(`Warning: Error parsing TypeScript ${filePath}:`, error);
            return {
                imports: [],
                exports: [],
                interfaces: [],
                types: [],
                content
            };
        }
    }

    getTypeScriptType(typeAnnotation) {
        if (!typeAnnotation) return 'any';
        
        const type = typeAnnotation.typeAnnotation;
        if (!type) return 'any';

        try {
            switch (type.type) {
                case 'TSStringKeyword':
                    return 'string';
                case 'TSNumberKeyword':
                    return 'number';
                case 'TSBooleanKeyword':
                    return 'boolean';
                case 'TSArrayType':
                    return `${this.getTypeScriptType({ typeAnnotation: type.elementType })}[]`;
                case 'TSTypeReference':
                    return type.typeName.name;
                default:
                    return 'any';
            }
        } catch (e) {
            return 'any';
        }
    }

    analyzeGenericFile(content, filePath) {
        return {
            type: 'generic',
            extension: filePath.split('.').pop()?.toLowerCase() || '',
            size: content.length,
            content
        };
    }

    async buildDependencyGraph(analyses) {
        const graph = new Map();
        
        // First pass: set up initial graph structure
        for (const [filePath, analysis] of analyses.entries()) {
            graph.set(filePath, {
                dependencies: analysis.imports?.map(imp => imp.source) || [],
                dependedOnBy: []
            });
        }

        // Second pass: resolve dependencies and build reverse dependencies
        for (const [filePath, node] of graph.entries()) {
            try {
                const resolvedDeps = await Promise.all(
                    node.dependencies.map(dep => this.resolveDependencyPath(filePath, dep))
                );
                node.dependencies = resolvedDeps;
                
                // Build reverse dependencies
                for (const dep of resolvedDeps) {
                    const depNode = graph.get(dep);
                    if (depNode) {
                        depNode.dependedOnBy.push(filePath);
                    }
                }
            } catch (e) {
                console.warn(`Warning: Error resolving dependencies for ${filePath}:`, e);
            }
        }

        return graph;
    }

    async resolveDependencyPath(fromPath, importPath) {
        if (importPath.startsWith('.')) {
            const resolvedPath = resolve(dirname(fromPath), importPath);
            // Try common extensions if not specified
            const extensions = ['.js', '.jsx', '.ts', '.tsx'];
            
            // Try exact path first
            try {
                await fsPromises.access(resolvedPath);
                return resolvedPath;
            } catch (e) {
                // Try with extensions
                for (const ext of extensions) {
                    try {
                        await fsPromises.access(resolvedPath + ext);
                        return resolvedPath + ext;
                    } catch (e) {
                        continue;
                    }
                }
                // If no match found, return original resolved path
                return resolvedPath;
            }
        }
        return importPath;
    }
}

export default CodeAnalyzer;