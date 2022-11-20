import { createServer, Socket } from "net";
import { randomUUID } from "crypto";
import dayjs from "dayjs";
import * as nodeUtil from "util";
import * as bencode from "bencode";
import * as tsNode from "ts-node";
import * as stream from "node:stream";

const operations = { clone: {}, describe: {}, eval: {} };

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

interface OpClone extends Message {
  op: "clone";
}

interface OpDescribe extends Message {
  op: "describe";
}

type Op = OpEval | OpClone | OpDescribe;

const server = createServer((socket: Socket) => {
  let sessionId: string;
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
          "new-session": randomUUID(),
          "time-stamp": dayjs().format("YYYY-MM-DD hh:mm:ss.SSS000000"),
          status: ["done"],
        });
        break;
      case "describe":
        send({ aux: {}, ops: operations });
        break;
      case "eval":
        send({ value: nodeUtil.inspect(repl.evalCode(clientMsg.code)) });
        send({ status: ["done"] });
        break;
    }
  });
});

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
