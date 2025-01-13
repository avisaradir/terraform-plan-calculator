const core = require('@actions/core');
const github = require('@actions/github');
const { execSync } = require('child_process');

class ResourceAnalyzer {
    constructor(sourceBranch, targetBranch, directory) {
        this.sourceBranch = sourceBranch;
        this.targetBranch = targetBranch;
        this.directory = directory;
    }

    getChangedFiles() {
        try {
            const command = `git diff --name-only ${this.targetBranch}..${this.sourceBranch} -- ${this.directory}`;
            const result = execSync(command, { encoding: 'utf-8' });
            return result.trim().split('\n').filter(file => file);
        } catch (error) {
            core.warning(`Error getting changed files: ${error.message}`);
            return [];
        }
    }

    getFileContent(filePath, branch) {
        try {
            const command = `git show ${branch}:${filePath}`;
            let content = execSync(command, { encoding: 'utf-8' });
            return content;
        } catch (error) {
            // If the file doesn't exist in the branch, return empty string
            core.warning(`Error reading file ${filePath} from branch ${branch}: ${error.message}`);
            return '';
        }
    }

    findResources(content) {
        const resources = [];
        if (!content) return resources;

        const lines = content.split('\n');

        lines.forEach((line, index) => {
            // Match any resource definition
            const match = line.match(/resource\s+"([^"]+)"\s+"([^"]+)"/);
            if (match) {
                resources.push({
                    type: match[1],
                    name: match[2],
                    line: index + 1
                });
            }
        });

        return resources;
    }

    async analyze() {
        const changedFiles = this.getChangedFiles();
        console.log('Changed files:', changedFiles);

        let changes = {
            added: [],
            removed: [],
            modified: []
        };

        for (const file of changedFiles) {
            const sourceContent = this.getFileContent(file, this.sourceBranch);
            const targetContent = this.getFileContent(file, this.targetBranch);

            const sourceResources = this.findResources(sourceContent);
            const targetResources = this.findResources(targetContent);

            // If the file is new (doesn't exist in target branch)
            if (!targetContent) {
                // All resources in the source are considered new
                sourceResources.forEach(resource => {
                    changes.added.push({
                        type: resource.type,
                        name: resource.name,
                        file: file
                    });
                });
                continue;
            }

            // If the file is deleted (doesn't exist in source branch)
            if (!sourceContent) {
                // All resources in the target are considered removed
                targetResources.forEach(resource => {
                    changes.removed.push({
                        type: resource.type,
                        name: resource.name,
                        file: file
                    });
                });
                continue;
            }

            // For existing files, compare resources
            sourceResources.forEach(resource => {
                const existsInTarget = targetResources.some(
                    r => r.type === resource.type && r.name === resource.name
                );
                if (!existsInTarget) {
                    changes.added.push({
                        type: resource.type,
                        name: resource.name,
                        file: file
                    });
                }
            });

            targetResources.forEach(resource => {
                const existsInSource = sourceResources.some(
                    r => r.type === resource.type && r.name === resource.name
                );
                if (!existsInSource) {
                    changes.removed.push({
                        type: resource.type,
                        name: resource.name,
                        file: file
                    });
                }
            });

            // Check for modifications in existing resources
            sourceResources.forEach(resource => {
                const existsInTarget = targetResources.some(
                    r => r.type === resource.type && r.name === resource.name
                );
                if (existsInTarget) {
                    try {
                        const command = `git diff ${this.targetBranch}..${this.sourceBranch} -- ${file}`;
                        const diff = execSync(command, { encoding: 'utf-8' });
                        const resourceRegex = new RegExp(`resource\\s+"${resource.type}"\\s+"${resource.name}"`);
                        if (diff.match(resourceRegex)) {
                            changes.modified.push({
                                type: resource.type,
                                name: resource.name,
                                file: file
                            });
                        }
                    } catch (error) {
                        core.warning(`Error checking modifications for ${file}: ${error.message}`);
                    }
                }
            });
        }

        return changes;
    }
}

async function run() {
    try {
        const sourceBranch = core.getInput('source_branch');
        const targetBranch = core.getInput('target_branch');
        const directory = core.getInput('directory');

        console.log(`Source Branch: ${sourceBranch}`);
        console.log(`Target Branch: ${targetBranch}`);
        console.log(`Directory: ${directory}`);

        const analyzer = new ResourceAnalyzer(sourceBranch, targetBranch, directory);
        const changes = await analyzer.analyze();

        // Log the results
        console.log('\nResource Changes Analysis:');
        console.log('------------------------');

        if (changes.added.length > 0) {
            console.log('\nAdded Resources:');
            changes.added.forEach(r => {
                console.log(`- ${r.type}/${r.name} in ${r.file}`);
            });
        }

        if (changes.removed.length > 0) {
            console.log('\nRemoved Resources:');
            changes.removed.forEach(r => {
                console.log(`- ${r.type}/${r.name} in ${r.file}`);
            });
        }

        if (changes.modified.length > 0) {
            console.log('\nModified Resources:');
            changes.modified.forEach(r => {
                console.log(`- ${r.type}/${r.name} in ${r.file}`);
            });
        }

        // Set outputs
        core.setOutput('changes', JSON.stringify(changes));
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();