import type { REPLServer } from "repl";
import type { AsyncCompleter } from "readline";
import { createServer, Socket } from "net";
import { randomUUID } from "crypto";
import dayjs from "dayjs";
import * as nodeUtil from "util";
import * as bencode from "bencode";
import * as tsNode from "ts-node";
import * as stream from "node:stream";

const CIDER_IGNORABLE_CLOJURE_CODE = [
  "(clojure.core/apply clojure.core/require clojure.main/repl-requires)",
];

const FAUX_VERSIONS = {
  clojure: { incremental: 1, major: 1, minor: 11, "version-string": "1.11.1" },
  java: {
    incremental: "1",
    major: "19",
    minor: "0",
    "version-string": "19.0.1",
  },
  nrepl: { incremental: 0, major: 1, minor: 0, "version-string": "1.0.0" },
};

const FAUX_AUX = {
  "cider-version": {
    incremental: 6,
    major: 0,
    minor: 28,
    qualifier: null,
    "version-string": "0.28.6",
  },
  "current-ns": "user",
};

const operations = {
  clone: {},
  describe: {},
  eval: {},
  "load-file": {},
  complete: {},
  completions: {},
  classpath: {},
};

interface Message {
  id: string;
  session?: string;
  op: keyof typeof operations;
}

interface OpEval extends Message {
  code: string;
  ns: string;
  op: "eval";
}

interface OpLoadFile extends Message {
  op: "load-file";
  ns: string;
  file: string;
  "file-name"?: string;
  "file-path"?: string;
}

interface OpComplete extends Message {
  // supporting both of these definitions:
  // https://nrepl.org/nrepl/1.0/ops.html#completions
  // https://docs.cider.mx/cider-nrepl/nrepl-api/ops.html#complete
  op: "complete" | "completions";
  prefix: string;
  ns?: string;
}

interface OpClone extends Message {
  op: "clone";
}

interface OpDescribe extends Message {
  op: "describe";
}

// we're tricking CIDER!!
interface OpClasspath extends Message {
  op: "classpath";
}

type Op = OpEval | OpClone | OpDescribe | OpLoadFile | OpComplete | OpClasspath;

const server = createServer((socket: Socket) => {
  const sessionId = randomUUID();
  const repl = makeRepl();

  socket.on("data", (socketData: Buffer) => {
    const clientMsg: Op = bencode.decode(socketData, "utf8");
    console.error(clientMsg);

    // send bencode to nREPL client, filling request ID and session ID if needed
    const send = (toSend: any) => {
      const enriched = { ...toSend, id: clientMsg.id, session: sessionId };
      return socket.write(bencode.encode(enriched));
    };

    switch (clientMsg.op) {
      case "clone":
        send({
          "new-session": sessionId,
          "time-stamp": dayjs().format("YYYY-MM-DD hh:mm:ss.SSS000000"),
          status: ["done"],
        });
        break;
      case "describe":
        send({
          ops: operations,
          aux: FAUX_AUX,
          versions: FAUX_VERSIONS,
          status: ["done"],
        });
        break;
      case "eval":
        sendEvalResultsOrErrors(repl.evalCode, send, clientMsg.code);
        break;
      case "load-file":
        sendEvalResultsOrErrors(repl.evalCode, send, clientMsg.file);
        break;
      case "completions":
      case "complete":
        const makeComp = (candidate: string) => ({
          candidate,
          ns: null,
          type: null,
        });
        repl.complete(clientMsg.prefix, (err, results) => {
          if (err) {
            send({ status: ["error", err] });
          } else if (results) {
            send({
              completions: results[0].map(makeComp),
              status: ["done"],
            });
          }
        });
        break;
      case "classpath":
        send({ classpath: ["thisPathIsNotReal"] });
        send({ status: ["done"] });
        break;
      default:
        console.error(`Unknown op: '${clientMsg["op"]}'`);
        send({ status: ["error", "unknown-op", "done"] });
    }
  });
});

/**
 * OpEval
 *
 * Evaluate `code` using `evalFunc`, sending its result using `sendFunc`.
 * If any errors were thrown, sends an "err" message and an "eval-error" one.
 * Regardless, sends a "done" status message at the end.
 */
function sendEvalResultsOrErrors(
  evalFunc: (code: string) => any,
  sendFunc: (toSend: any) => boolean,
  code: string
) {
  if (CIDER_IGNORABLE_CLOJURE_CODE.includes(code)) {
    sendFunc({ value: null });
  } else {
    try {
      sendFunc({ value: nodeUtil.inspect(evalFunc(code)) });
    } catch (_e) {
      const exception = _e as Error;

      // This is non-standard, but seems like clients expect it
      sendFunc({ err: `${exception.toString()}\n` });

      const elaborateError = `${exception.toString()}\n${exception.stack}`;
      console.error(elaborateError);
      sendFunc({
        ex: elaborateError,
        "root-ex": exception.name,
        status: ["eval-error"],
      });
    }
  }
  sendFunc({ ns: "user" });
  sendFunc({ status: ["done"] });
}

/**
 * Returns a ts-node REPL allowing redeclarations
 */
function makeRepl(): tsNode.ReplService & { complete: AsyncCompleter } {
  const tsNodeInStream = new stream.Readable({ read: () => {} });
  // it only writes the prompt ">", so I think we can peacefully discard it
  const tsNodeOutStream = new stream.Writable({ write: () => {} });
  const repl = tsNode.createRepl({
    stdin: tsNodeInStream,
    stdout: tsNodeOutStream,
  });
  const service = tsNode.create({
    ...repl.evalAwarePartialHost,
    // lets us redeclare variables freely (even consts!)
    transpileOnly: true,
  });
  repl.setService(service);

  // @ts-ignore needed for completions.
  // `startInternal()` is omitted from the `.d.ts` but still exists in the
  // emitted JS. For some reason, the only thing that the start() method does
  // is discard startInternals's return value, which is a REPLServer. So we're
  // doing this trick here because I don't wanna re-implement completions :P
  const internalReplServer: REPLServer = repl.startInternal();

  return { ...repl, complete: internalReplServer.completer };
}

server.listen(1337, "127.0.0.1");
