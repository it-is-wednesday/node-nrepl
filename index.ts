import { createServer, Socket } from "net";
import { randomUUID } from "crypto";
import dayjs from "dayjs";
import * as nodeUtil from "util";
import * as bencode from "bencode";
import * as tsNode from "ts-node";
import * as stream from "node:stream";

const operations = { clone: {}, describe: {}, eval: {}, "load-file": {} };

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

interface OpClone extends Message {
  op: "clone";
}

interface OpDescribe extends Message {
  op: "describe";
}

type Op = OpEval | OpClone | OpDescribe | OpLoadFile;

const server = createServer((socket: Socket) => {
  const sessionId = randomUUID();
  const repl = makeRepl();

  socket.on("data", (socketData: Buffer) => {
    const clientMsg: Op = bencode.decode(socketData, "utf8");

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
        send({ aux: {}, ops: operations });
        break;
      case "eval":
        sendEvalResultsOrErrors(repl.evalCode, send, clientMsg.code);
        break;
      case "load-file":
        sendEvalResultsOrErrors(repl.evalCode, send, clientMsg.file);
        break;
      default:
        console.error(`Unknown op: '${clientMsg["op"]}'`);
        send({ status: ["error", "unknown-op", "done"] });
    }
  });
});

/**
 * OpEval abstraction
 * Evaluate `code` using `evalFunc`, sending its result using `sendFunc`.
 * If any errors were thrown, sends an "err" message and an "eval-error" one.
 * Regardless, sends a "done" status message at the end.
 */
function sendEvalResultsOrErrors(
  evalFunc: (code: string) => any,
  sendFunc: (toSend: any) => boolean,
  code: string
) {
  try {
    sendFunc({ value: nodeUtil.inspect(evalFunc(code)) });
  } catch (exception) {
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
  sendFunc({ status: ["done"] });
}

/**
 * Returns a ts-node REPL allowing redeclarations
 */
function makeRepl(): tsNode.ReplService {
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
  repl.start();
  return repl;
}

server.listen(1337, "127.0.0.1");
