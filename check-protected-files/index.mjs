#!/usr/bin/env zx

import { $, minimist, path } from "zx";
import fs from "fs/promises";
import students from "../data/students.json" with { type: "json" };
import protectedFiles from "./protected-files.json" with { type: "json" };
import { rimraf } from "rimraf";
import pMap from "p-map";

usePowerShell();

const argv = minimist(process.argv.slice(2), {});

const EXERCISE = argv._[1];

if (!EXERCISE) {
  throw new Error("Missing the exercise argument");
}

const REPOS_FILE = "./repos.json";

const TEMPLATE_REPO = `https://github.com/hh-programming-2-exercises/${EXERCISE}.git`;
const UPSTREAM_BRANCH = "master";

const FOLDERS_TO_CHECK = [
  ".github",
  ".grading",
  ...(protectedFiles[EXERCISE] ?? []),
];

const WORKDIR = path.join(
  import.meta.dirname,
  "..",
  "data",
  "./tmp-repo-check",
);

function getRepositories() {
  return students.map(({ githubUsername }) => ({
    owner: githubUsername,
    repo: `programming-2-${EXERCISE}`,
  }));
}

async function checkRepository(owner, repo) {
  const repoName = repo;
  const repoDir = path.join(WORKDIR, `${owner}-${repo}`);
  const repoUrl = `https://github.com/${owner}/${repo}.git`;

  try {
    try {
      await fs.access(repoDir);

      await $`git -C ${repoDir} fetch origin`.quiet();
    } catch {
      await $`git clone --quiet ${repoUrl} ${repoDir}`.quiet();
    }

    let hasUpstream = true;

    await $`git -C ${repoDir} remote add upstream ${TEMPLATE_REPO}`.quiet();
    await $`git -C ${repoDir} fetch upstream ${UPSTREAM_BRANCH}`.quiet();

    const diff =
      await $`git -C ${repoDir} diff --name-only upstream/${UPSTREAM_BRANCH} -- ${FOLDERS_TO_CHECK}`.quiet();

    const changedFiles = diff.stdout.trim().split("\n").filter(Boolean);

    if (changedFiles.length > 0) {
      console.log(
        `Protected files changed in repository ${owner}/${repo}:\n`,
      );

      console.log(
        (
          await $`git -C ${repoDir} diff upstream/${UPSTREAM_BRANCH} -- ${FOLDERS_TO_CHECK}`
        ).toString(),
      );
    }

    return changedFiles;
  } catch (err) {
    console.error(`Failed: ${repoUrl}`);
    console.error(err.message);

    return [];
  }
}

async function main() {
  await rimraf([WORKDIR]);
  await fs.mkdir(WORKDIR, { recursive: true });

  const repositories = getRepositories();

  const repositoriesWithChangedFiles = await pMap(
    repositories,
    async (repository) => {
      return {
        ...repository,
        changedFiles: await checkRepository(repository.owner, repository.repo),
      };
    },
    { concurrency: 5 },
  );

  const changedRepos = repositoriesWithChangedFiles.filter(
    ({ changedFiles }) => changedFiles.length > 0,
  );

  if (changedRepos.length > 0) {
    console.log("Repositories with changes in protected files:");

    for (const repo of changedRepos) {
      console.log(`\n${repo.owner}/${repo.repo}`);

      for (const file of repo.changedFiles) {
        console.log(`\t- ${file}`);
      }
    }
  }
}

main();
