// Configures the Express application separately from the process that starts it.
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import authRouter from "./routes/auth.route.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGINS,
    credentials: true,
  }),
);
app.use(express.json({ limit: "16kb" }));

app.use("/api/auth", authRouter);

app.get("/test", (req, res) => {
  res.send("Hello World");
});

app.use(errorHandler);
