import fs from "node:fs/promises";
import path from "path";
import { glob } from "glob";

const STUDENT_INFORMATION_SUBMISSION_PATH_REGEXP =
  /(?<fullName>[\w ]+)_(?<studentNumber>[0-9]+)_assignsubmission/;

const GITHUB_USERNAME_REGEXP =
  />(?:https:\/\/github.com\/)?(?<githubUsername>[\w_-]+)</;

export function parseGitSubmissionPath(submissionPath) {
  const { fullName, studentNumber } =
    STUDENT_INFORMATION_SUBMISSION_PATH_REGEXP.exec(submissionPath).groups;

  return {
    fullName,
    studentNumber,
  };
}

export function parseGitHubUsername(submissionContent) {
  const { githubUsername } =
    GITHUB_USERNAME_REGEXP.exec(submissionContent)?.groups ?? {};

  return githubUsername ?? null;
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

  return students;
}

async function main() {
  const students = await getStudents();

  await fs.writeFile(
    path.join(import.meta.dirname, "..", "data", "students.json"),
    JSON.stringify(students, null, 2),
  );
}

main();
