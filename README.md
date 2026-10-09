# Tools

Teacher's tools for the Programming 2 course. Requires [GitHub CLI](https://cli.github.com/).

Authenticate using GitHub CLI:

```bash
gh auth login
```

Add a `config.json` file to the `data` folder:

```json
{
  "templateRepositoryOrganization": "hh-programming-2-exercises",
  "repositoryNamePrefix": "programming-2",
  "protectedFiles": {
    "warming-up": "src/test",
    "map": "src/test",
    "inheritance-interfaces": "src/test",
    "sorting-and-filtering": "src/test",
    "sql-databases": "src/test",
    "streams-and-lambdas": "src/test",
    "commit-history": "src/test"
  }
}
```

Available scripts:

```bash
npm run create-student-list
npm run check-protected-files -- "warming-up"
npm run fetch-exercise-points -- "warming-up"
npm run grade
```