#!/usr/bin/env zx

import { $, minimist, path } from "zx";
import fs from "fs/promises";
import students from "../data/students.json" with { type: "json" };
import protectedFiles from "./protected-files.json" with { type: "json" };
import { rimraf } from "rimraf";

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

async function main() {
  await rimraf([WORKDIR]);
  await fs.mkdir(WORKDIR, { recursive: true });

  const changedRepos = [];
  const repositories = getRepositories();

  for (const repository of repositories) {
    const repoName = repository.repo;
    const repoDir = path.join(
      WORKDIR,
      `${repository.owner}-${repository.repo}`,
    );
    const repoUrl = `https://github.com/${repository.owner}/${repository.repo}.git`;

    try {
      try {
        await fs.access(repoDir);

        await $`git -C ${repoDir} fetch origin`.quiet();
      } catch {
        await $`git clone --quiet ${repoUrl} ${repoDir}`.quiet();
      }

      let hasUpstream = true;

      try {
        await $`git -C ${repoDir} remote get-url upstream`.quiet();
      } catch {
        hasUpstream = false;
      }

      if (!hasUpstream) {
        await $`git -C ${repoDir} remote add upstream ${TEMPLATE_REPO}`.quiet();
      }

      await $`git -C ${repoDir} fetch upstream ${UPSTREAM_BRANCH}`.quiet();

      const diff =
        await $`git -C ${repoDir} diff --name-only upstream/${UPSTREAM_BRANCH} -- ${FOLDERS_TO_CHECK}`.quiet();

      const changedFiles = diff.stdout.trim().split("\n").filter(Boolean);

      if (changedFiles.length > 0) {
        changedRepos.push({
          repo: repoUrl,
          files: changedFiles,
        });

        console.log(
          `Protected files changed in ${repository.owner}/${repository.repo}!`,
        );

        console.log(
          (
            await $`git -C ${repoDir} diff upstream/${UPSTREAM_BRANCH} -- ${FOLDERS_TO_CHECK}`
          ).toString(),
        );
      } else {
        console.log("No changes.");
      }
    } catch (err) {
      console.error(`Failed: ${repoUrl}`);
      console.error(err.message);
    }
  }

  if (changedRepos.length > 0) {
    console.log("Repositories with changes in protected files:");

    for (const repo of changedRepos) {
      console.log(`\n${repo.repo}`);

      for (const file of repo.files) {
        console.log(`\t- ${file}`);
      }
    }
  }
}

main();
