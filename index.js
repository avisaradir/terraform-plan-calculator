const core = require('@actions/core');
const github = require('@actions/github');
const { execSync } = require('child_process');
const fs = require('fs');

async function run() {
    try {
        const sourceBranch = core.getInput('source_branch');
        const targetBranch = core.getInput('target_branch');
        const directory = core.getInput('directory');

        console.log(`Source Branch: ${sourceBranch}`);
        console.log(`Target Branch: ${targetBranch}`);
        console.log(`Directory: ${directory}`);

        const analyzer = new ResourceAnalyzer(sourceBranch, targetBranch, directory);
        const changes = analyzer.analyze();

        // Save changes to a JSON file
        fs.writeFileSync('changes.json', JSON.stringify({ changes }, null, 2));

        // Also set as action output
        core.setOutput('changes', JSON.stringify(changes));

        // Log results
        console.log('\nChange Summary:');
        changes.forEach(change => {
            console.log(`- ${change.action.toUpperCase()}: ${change.type} "${change.name}" in ${change.path}`);
        });
    } catch (error) {
        core.setFailed(error.message);
    }
}

class ResourceAnalyzer {
    constructor(sourceBranch, targetBranch, directory) {
        this.sourceBranch = sourceBranch;
        this.targetBranch = targetBranch;
        this.directory = directory || '.';
    }

    getChangedFiles() {
        try {
            // Use git status to detect new files
            let command = `git ls-files --others --exclude-standard ${this.directory}`;
            const untracked = execSync(command, { encoding: 'utf-8' })
                .trim()
                .split('\n')
                .filter(file => file);

            // Get tracked files that changed
            command = `git diff --name-only ${this.targetBranch}..${this.sourceBranch} -- ${this.directory}`;
            const tracked = execSync(command, { encoding: 'utf-8' })
                .trim()
                .split('\n')
                .filter(file => file);

            // Combine both lists and remove duplicates
            const allChangedFiles = [...new Set([...untracked, ...tracked])];
            console.log('All changed files:', allChangedFiles);

            return allChangedFiles;
        } catch (error) {
            core.warning(`Error getting changed files: ${error.message}`);
            return [];
        }
    }

    readFileContent(filePath) {
        try {
            return fs.readFileSync(filePath, 'utf-8');
        } catch (error) {
            core.warning(`Error reading file ${filePath}: ${error.message}`);
            return '';
        }
    }

    findModulesAndResources(content, filePath) {
        const results = {
            resources: [],
            modules: []
        };

        if (!content) return results;

        const lines = content.split('\n');
        let currentBlock = null;
        let bracketCount = 0;

        lines.forEach((line, index) => {
            const resourceMatch = line.match(/resource\s+"([^"]+)"\s+"([^"]+)"/);
            const moduleMatch = line.match(/module\s+"([^"]+)"/);

            if (resourceMatch && !currentBlock) {
                results.resources.push({
                    type: resourceMatch[1],
                    name: resourceMatch[2],
                    file: filePath
                });
            } else if (moduleMatch && !currentBlock) {
                results.modules.push({
                    name: moduleMatch[1],
                    file: filePath
                });
            }

            if (line.includes('{')) bracketCount++;
            if (line.includes('}')) bracketCount--;
        });

        return results;
    }

    analyze() {
        const changedFiles = this.getChangedFiles();
        const changes = [];

        for (const file of changedFiles) {
            const content = this.readFileContent(file);
            const items = this.findModulesAndResources(content, file);

            // Add all resources as created
            items.resources.forEach(resource => {
                changes.push({
                    name: `${resource.type}/${resource.name}`,
                    type: 'resource',
                    action: 'create',
                    path: file
                });
            });

            // Add all modules as created
            items.modules.forEach(module => {
                changes.push({
                    name: module.name,
                    type: 'module',
                    action: 'create',
                    path: file
                });
            });
        }

        return changes;
    }
}

run();