// Configures the Express application separately from the process that starts it.
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import agendaRouter from "./routes/agenda.route.js";
import attendanceRouter from "./routes/attendance.route.js";
import authRouter from "./routes/auth.route.js";
import classRouter from "./routes/class.route.js";
import recitationRouter from "./routes/recitation.route.js";
import settingsRouter from "./routes/settings.route.js";
import studentRouter from "./routes/student.route.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGINS,
    credentials: true,
  }),
);
app.use(
  "/api/attendance",
  express.json({ limit: "128kb" }),
  attendanceRouter,
);
app.use(
  "/api/recitations",
  express.json({ limit: "128kb" }),
  recitationRouter,
);
app.use(express.json({ limit: "16kb" }));

app.use("/api/agenda", agendaRouter);
app.use("/api/auth", authRouter);
app.use("/api/classes", classRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/students", studentRouter);

// Provides a minimal process-independent endpoint for confirming that Express responds.
app.get("/test", (req, res) => {
  res.send("Hello World");
});

app.use(errorHandler);
