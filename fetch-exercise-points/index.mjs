#!/usr/bin/env zx

import { mkdir, writeFile } from "node:fs/promises";
import { $, argv, path } from "zx";
import students from "../data/students.json" with { type: "json" };
import config from "../data/config.json" with { type: "json" };
import pMap from "p-map";

usePowerShell();

const POINTS_REGEX = /🏅\s*Total points:\s*(\d+)\/\d+/g;

const EXERCISE = argv._[0];

if (!EXERCISE) {
  throw new Error("Missing the exercise argument");
}

const WORKFLOW = "grading.yml";

function getRepositories() {
  return students.map(({ githubUsername }) => ({
    owner: githubUsername,
    repo: `${config.repositoryNamePrefix}-${EXERCISE}`,
  }));
}

async function getLatestRun(owner, repo) {
  try {
    const runs = await $`
      gh run list --repo ${owner}/${repo} --workflow ${WORKFLOW} --limit 1 --json databaseId,createdAt`.json();

    return runs[0] ?? null;
  } catch (err) {
    console.error(`Failed to get runs for ${owner}/${repo}:`, err.message);
    return null;
  }
}

async function getRunLogs(owner, repo, runId) {
  try {
    const result = await $`gh run view ${runId} --repo ${owner}/${repo} --log`;

    return result.stdout;
  } catch (err) {
    console.error(
      `Failed to get logs for ${owner}/${repo} run ${runId}:`,
      err.message,
    );
    return "";
  }
}

function extractPoints(logs) {
  const match = Array.from(logs.matchAll(POINTS_REGEX)).at(-1);

  return match ? Number(match[1]) : null;
}

async function processRepository(owner, repo) {
  const run = await getLatestRun(owner, repo);

  if (!run) {
    return {
      username: owner,
      points: 0,
      timestamp: null,
    };
  }

  const logs = await getRunLogs(owner, repo, run.databaseId);
  const points = extractPoints(logs);

  if (points === null) {
    console.log(
      `Could not extract points from repository ${owner}/${repo} run ${run.databaseId} logs`,
    );
  }

  return {
    username: owner,
    points: points ?? 0,
    timestamp: run.createdAt,
    repositoryUrl: `https://github.com/${owner}/${repo}.git`,
  };
}

async function main() {
  const repositories = getRepositories();

  const results = await pMap(
    repositories,
    (repository) => processRepository(repository.owner, repository.repo),
    {
      concurrency: 5,
    },
  );

  await mkdir(path.join(import.meta.dirname, "..", "data", "points"), {
    recursive: true,
  });

  await writeFile(
    path.join(import.meta.dirname, "..", "data", "points", `${EXERCISE}.json`),
    JSON.stringify(results, null, 2),
  );

  const plagiarismConfig = {
    template: `https://github.com/${config.templateRepositoryOrganization}/${EXERCISE}.git`,
    repositories: results
      .filter(({ points }) => points > 0)
      .map(({ repositoryUrl }) => repositoryUrl),
  };

  await mkdir(
    path.join(import.meta.dirname, "..", "data", "plagiarism-configs"),
    {
      recursive: true,
    },
  );

  await writeFile(
    path.join(
      import.meta.dirname,
      "..",
      "data",
      "plagiarism-configs",
      `${EXERCISE}.json`,
    ),
    JSON.stringify(plagiarismConfig, null, 2),
  );
}

await main();
