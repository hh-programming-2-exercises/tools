import fs from "node:fs/promises";
import path from "path";
import { glob } from "glob";
import pMap from "p-map";

const STUDENT_INFORMATION_SUBMISSION_PATH_REGEXP =
  /(?<fullName>[\w ]+)_(?<studentNumber>[0-9]+)_assignsubmission/;

const GITHUB_USERNAME_REGEXP =
  />(?:https:\/\/github.com\/)?(?<githubUsername>[\w_-]+)</;

function parseGitSubmissionPath(submissionPath) {
  const { fullName, studentNumber } =
    STUDENT_INFORMATION_SUBMISSION_PATH_REGEXP.exec(submissionPath).groups;

  return {
    fullName,
    studentNumber,
  };
}

function parseGitHubUsername(submissionContent) {
  const { githubUsername } =
    GITHUB_USERNAME_REGEXP.exec(submissionContent)?.groups ?? {};

  return githubUsername ?? null;
}

async function getInvalidGitHubUsernames(usernames) {
  const invalidUsernames = await pMap(
    [...new Set(usernames)],
    async (username) => {
      const response = await fetch(
        `https://api.github.com/users/${encodeURIComponent(username)}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "haaga-helia-programming-2-scripts",
          },
        },
      );

      if (response.status === 404) {
        return username;
      } else if (!response.ok) {
        console.error(
          `GitHub API request failed for ${username}: ${response.status} ${response.statusText}`,
        );
      }
      return null;
    },
    { concurrency: 5 },
  );

  return invalidUsernames.filter(Boolean);
}

async function getStudents() {
  const exerciseGlob = await glob(["data/username-submissions/*/*.html"]);
  const students = [];

  for (const file of exerciseGlob) {
    const content = await fs.readFile(file, { encoding: "utf8" });
    const { fullName, studentNumber } = parseGitSubmissionPath(file);
    const githubUsername = parseGitHubUsername(content);

    if (githubUsername) {
      students.push({
        fullName,
        studentNumber,
        githubUsername,
      });
    } else {
      console.error(
        `Missing GitHub username for student ${fullName}, ${studentNumber}`,
      );
    }
  }

  const invalidGitHubUsernames = new Set(
    await getInvalidGitHubUsernames(
      students.map(({ githubUsername }) => githubUsername),
    ),
  );

  for (const student of students) {
    if (invalidGitHubUsernames.has(student.githubUsername)) {
      console.error(
        `Invalid GitHub username for student ${student.fullName}, ${student.studentNumber}: ${student.githubUsername}`,
      );
    }
  }

  return students.map((student) => ({
    ...student,
    validGithubUsername: !invalidGitHubUsernames.has(student.githubUsername),
  }));
}

async function main() {
  const students = await getStudents();

  await fs.writeFile(
    path.join(import.meta.dirname, "..", "data", "students.json"),
    JSON.stringify(students, null, 2),
  );
}

main();
