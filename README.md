# Terraform Plan Calculator Action

A GitHub Action that computes differences between two branches and generates module target plans for Terraform resources.

## Features

- Automatically detects changes between source and target branches
- Generates targeted Terraform plans based on detected changes
- Provides a computed list of changed resources
- Simple integration with existing GitHub workflows

## Usage

Add the following workflow to your repository (e.g., `.github/workflows/terraform-plan.yml`):

```yaml
name: Terraform Plan Calculator

on:
  pull_request:
    branches:
      - main

jobs:
  terraform-plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Calculate Terraform Plans
        uses: avisaradir/terraform-plan-calculator@v1
```

## Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `source_branch` | The source branch to compare | No | `${{ github.head_ref }}` |
| `target_branch` | The target branch to compare | No | `main` |
| `directory` | The terraform state directory path to use | No | `/` |

## Outputs

| Name | Description |
|------|-------------|
| `changes` | Computed changed resources list |

## Example

```yaml
- name: Run Terraform Plan Calculator
  uses: avisaradir/terraform-plan-calculator@v1
  with:
    source_branch: ${{ github.head_ref }}
    target_branch: ${{ github.base_ref }}
    directory: /terraform
```

## How It Works

1. The action compares the specified source branch (defaults to PR head branch) with the target branch (defaults to main)
2. It analyzes changes in the specified directory
3. Computes the list of affected Terraform resources
4. Outputs the changes for further processing or reporting

## Technical Details

- Runs on Node.js 20
- Main entry point: `index.js`
- Automatically handles GitHub context for branch references

## Requirements

- GitHub Actions runner
- Repository with Terraform configurations
- Appropriate GitHub Actions permissions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

avisaradir
