import fs from "node:fs/promises";
import path from "node:path";

const DATA_PATH = path.join(import.meta.dirname, "..", "data");

function roundPoints(value) {
  return Math.round(value * 100) / 100;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getFinalGrade(student) {
  if (student.exerciseGrade === 0 || student.examGrade === 0) {
    return 0;
  }

  return Math.round(student.examGrade * 0.4 + student.exerciseGrade * 0.6);
}

function getFooter(student) {
  if (student.examGrade === 0) {
    return "<p><strong>You'll need to retake the exam!</strong></p>";
  }

  if (getFinalGrade(student) >= 3) {
    return "<p>Good job!</p>";
  }

  return "";
}

function createStudentReport(student, exercises) {
  const exercisePoints = exercises.map((exerciseName) => {
    const point = student.points.find(
      (point) => point.exerciseName === exerciseName,
    );

    return roundPoints(point?.points ?? 0);
  });

  const totalPoints = roundPoints(
    exercisePoints.reduce((sum, points) => sum + points, 0),
  );

  return [
    `<h2>${escapeHtml(student.fullName)}</h2>`,
    `<p>Exercise points: ${exercisePoints.join(" + ")} = ${totalPoints}</p>`,
    `<p>Exercise grade: ${student.exerciseGrade}</p>`,
    `<p>Exam grade: ${student.examGrade}</p>`,
    `<p>Final grade: ${getFinalGrade(student)}</p>`,
    getFooter(student),
  ].join("\n");
}

async function main() {
  const config = JSON.parse(
    await fs.readFile(path.join(DATA_PATH, "config.json"), "utf8"),
  );
  const grading = JSON.parse(
    await fs.readFile(path.join(DATA_PATH, "grading.json"), "utf8"),
  );

  const studentReports = grading.map((student) =>
    createStudentReport(student, config.exercises),
  );

  const html = studentReports.join("\n\n");

  await fs.writeFile(path.join(DATA_PATH, "assessment-report.html"), html);
}

main();
