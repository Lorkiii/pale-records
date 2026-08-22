// Starts the configured Express application on the validated server port.
import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
  console.log(`Server is running on port http://localhost:${env.PORT}`);
});
