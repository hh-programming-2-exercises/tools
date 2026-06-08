import fs from "node:fs/promises";
import path from "path";
import { glob } from "glob";
import students from "../data/students.json" with { type: "json" };

const GIT_HELLO_WORLD = "git-hello-world";
const WARM_UP = "warming-up";
const FIRST_WEEK_EXERCISES = [GIT_HELLO_WORLD, WARM_UP];

function getFileName(filePath) {
  return path.parse(filePath).name;
}

async function getExercisePoints() {
  const exerciseGlob = await glob(["data/exercises/*.json"]);
  const exercisePoints = [];

  for (const file of exerciseGlob) {
    const exercise = getFileName(file);
    const points = JSON.parse(await fs.readFile(file, { encoding: "utf8" }));
    exercisePoints.push({
      exercise,
      points,
    });
  }

  return exercisePoints;
}

async function studentsWithExercisePoints(students) {
  const exercisePoints = await getExercisePoints();

  return students.map((student) => ({
    ...student,
    rawPoints: exercisePoints.map((exercise) => {
      const studentPoints = exercise.points.find(
        ({ username }) => username === student.githubUsername,
      );

      return {
        exerciseName: exercise.exercise,
        submissionTimestamp: studentPoints?.timestamp ?? null,
        points: studentPoints?.points ?? 0,
      };
    }),
  }));
}

function getStudentGrading(student) {
  const { rawPoints } = student;

  const gitHelloWorldPoints =
    rawPoints.find(({ exerciseName }) => exerciseName === GIT_HELLO_WORLD)
      ?.points ?? 0;

  const warmUpPoints =
    rawPoints.find(({ exerciseName }) => exerciseName === WARM_UP)?.points ?? 0;

  const scaledWarmUpPoints = (warmUpPoints / 20) * 0.8;

  const pointInformationAfterFirstWeek = rawPoints
    .filter(
      ({ exerciseName }) =>
        exerciseName && !FIRST_WEEK_EXERCISES.includes(exerciseName),
    )
    .map(({ exerciseName, points }) => ({
      exerciseName,
      points: points / 20,
    }));

  const scaledPoints = [
    { exerciseName: GIT_HELLO_WORLD, points: gitHelloWorldPoints },
    { exerciseName: WARM_UP, points: scaledWarmUpPoints },
    ...pointInformationAfterFirstWeek,
  ];

  const pointsAfterFirstWeek = pointInformationAfterFirstWeek
    .map(({ points }) => points)
    .reduce((sum, current) => sum + current, 0);

  const totalPoints =
    gitHelloWorldPoints + scaledWarmUpPoints + pointsAfterFirstWeek;

  const grade = totalPoints < 8 ? 0 : Math.round(totalPoints / 8);

  return {
    scaledPoints,
    grade,
  };
}

async function getStudentsWithGradingInformation() {
  const studentsWithPoints = await studentsWithExercisePoints(students);

  return studentsWithPoints.map((student) => ({
    ...student,
    ...getStudentGrading(student),
  }));
}

async function writeGradingInformation() {
  const students = await getStudentsWithGradingInformation();

  const formattedStudents = students.map(
    ({ fullName, studentNumber, githubUsername, scaledPoints, grade }) => ({
      fullName,
      studentNumber,
      githubUsername,
      grade,
      points: scaledPoints,
    }),
  );

  await fs.writeFile(
    path.join(import.meta.dirname, "..", "data", "grading.json"),
    JSON.stringify(formattedStudents, null, 2),
  );
}

await writeGradingInformation();
