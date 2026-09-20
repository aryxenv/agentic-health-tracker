import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const localSettings = JSON.parse(
  fs.readFileSync("./api/local.settings.json", "utf-8"),
);
process.env.GROQ_API_KEY = localSettings.Values.GROQ_API_KEY;
process.env.GROQ_MODEL = "openai/gpt-oss-20b";

const { runHealthAgentStream } =
  await import("../api/dist/src/services/mafHealthAgent.js");

test("MAF Health Agent Stream Text Deltas Suite", async (t) => {
  await t.test(
    "runHealthAgentStream emits text deltas via onDelta callback",
    async () => {
      const receivedDeltas = [];
      const receivedSteps = [];

      const response = await runHealthAgentStream(
        [
          {
            role: "user",
            content: 'Say "Stream test passed!" and nothing else.',
          },
        ],
        {
          weightKg: 75,
          heightCm: 180,
          age: 25,
          sex: "male",
          activityLevel: "moderate",
          goal: "maintain",
        },
        (step) => receivedSteps.push(step),
        (delta) => receivedDeltas.push(delta),
      );

      assert.ok(response, "Response should exist");
      assert.ok(typeof response.reply === "string", "Reply should be a string");
      assert.ok(
        receivedDeltas.length > 0,
        "Deltas should be received during streaming",
      );
      const combinedDeltas = receivedDeltas.join("");
      assert.ok(
        combinedDeltas.length > 0,
        "Combined deltas should have length > 0",
      );
    },
  );
});
