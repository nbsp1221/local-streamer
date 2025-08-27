---
name: implement
description: Comprehensive implementation workflow with codebase analysis, planning, development, and validation
argument-hint: [optional task description]
---

## Triggers

- Complex feature implementations requiring systematic approach
- Multi-step development tasks needing quality assurance
- When you need comprehensive codebase analysis before implementation
- Projects requiring E2E testing validation
- Full development lifecycle from analysis to deployment

## Usage

```
/implement [optional task description]
/implement "Add user authentication system"
/implement "Refactor video processing pipeline"
```

## Behavioral Flow

1. **Initial Analysis**: Execute `gemini --help` command to analyze entire codebase using Gemini 2.5 Pro model, leveraging 1M context window for comprehensive structural and dependency insights
2. **Strategic Planning**: Combine Gemini analysis with additional in-depth code examination to formulate implementation strategy and create detailed execution plan
3. **Plan & Execute**: Create comprehensive TodoWrite task list and begin immediate implementation without requiring user approval
4. **QA Gate 1**: Execute quality assurance sequence in order:
   - `bun run lint:fix` - Fix linting issues automatically
   - `bun run typecheck` - Validate TypeScript types
   - `bun run test` - Run test suite
   - `bun run build` - Create production build
   - Resolve all discovered errors before proceeding
5. **E2E Validation**: Reference E2E_TESTING_GUIDE.md to run comprehensive end-to-end tests focusing on modified functionality, resolve all issues
6. **Final Integrity Check**: Re-execute complete QA process from step 4 to ensure all checks pass without errors
7. **Final Report**: Submit comprehensive summary of completed work, changes made, and validation results

## Tool Coordination

- **Bash**: Execute gemini analysis, run build/test/lint commands, run E2E tests
- **Read/Grep/Glob**: Deep codebase examination and pattern analysis
- **TodoWrite**: Create and manage implementation task lists
- **Write/Edit/MultiEdit**: Implement code changes and modifications
- **Task**: Delegate complex analysis or search tasks to specialized agents
- **WebFetch**: Reference documentation when needed for implementation

## Boundaries

This command will:
- Perform comprehensive codebase analysis using Gemini 2.5 Pro
- Create detailed implementation plans with task tracking
- Execute full development lifecycle including coding and testing
- Run complete quality assurance validation
- Provide comprehensive final reporting
- Follow established code conventions and project standards
- Resolve all build, test, and lint errors systematically

This command will not:
- Skip quality assurance steps or ignore failing tests
- Proceed with incomplete implementations
- Modify deployment configurations without explicit approval
- Create or modify security-sensitive code without validation
- Bypass existing authentication or authorization mechanisms
- Make changes to production data or configurations
- Proceed if Gemini analysis reveals security concerns
