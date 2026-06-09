#!/usr/bin/env zx

import { readFile, writeFile } from "node:fs/promises";
import { $, minimist, path } from "zx";
import students from "../data/students.json" with { type: "json" };
import pMap from "p-map";

usePowerShell();

const POINTS_REGEX = /🏅\s*Total points:\s*(\d+)\/\d+/;

const argv = minimist(process.argv.slice(2), {});

const EXERCISE = argv._[1];

if (!EXERCISE) {
  throw new Error("Missing the exercise argument");
}

const WORKFLOW = "grading.yml";

function getRepositories() {
  return students.map(({ githubUsername }) => ({
    owner: githubUsername,
    repo: `programming-2-${EXERCISE}`,
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
  const match = logs.match(POINTS_REGEX);
  return match ? Number(match[1]) : 0;
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

  return {
    username: owner,
    points: extractPoints(logs),
    timestamp: run.createdAt,
    repositoryUrl: `https://github.com/${owner}/${repo}`,
  };
}

async function main() {
  const repositories = getRepositories();

  const results = await pMap(
    repositories,
    (repository) => {
      console.log(`Processing ${repository.owner}/${repository.repo}`);
      return processRepository(repository.owner, repository.repo);
    },
    {
      concurrency: 5,
    },
  );

  await writeFile(
    path.join(
      import.meta.dirname,
      "..",
      "data",
      "exercises",
      `${EXERCISE}.json`,
    ),
    JSON.stringify(results, null, 2),
  );
}

await main();
