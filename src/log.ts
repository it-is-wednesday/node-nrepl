import type { Message } from "./index";
import * as nodeUtil from "util";
import c from "./deps/ansi-colors";

const debugKeyColor = c.magenta;

const allColors = [
  c.red,
  c.green,
  c.yellow,
  c.blue,
  c.magenta,
  c.cyan,
  c.redBright,
  c.greenBright,
  c.yellowBright,
  c.blueBright,
  c.magentaBright,
  c.cyanBright,
];

/**
 * Generate a psuedo random color from seed, so the same msg ID will always
 * provide the same color
 */
function colorByMsgId(msgId: string): c.StyleFunction {
  const seed = Math.abs(Math.sin(parseInt(msgId)));
  const index = Math.floor(seed * allColors.length);
  return allColors[index];
}

/** Pretty-print the message in a style similar to `nrepl-client`'s `nrepl-log-messages` */
export function logMsg(msg: Message, direction: "in" | "out") {
  const printColored = (obj: string) => console.log(colorByMsgId(msg.id).bold(obj));

  const arrow = direction === "out" ? "-->" : "<--";
  printColored(`(${arrow}`);

  const longestKey = Math.max(...Object.keys(msg).map((key) => key.length));

  for (const [key, val] of Object.entries(msg)) {
    const key_ = c.bold(debugKeyColor(key.padEnd(longestKey + 1)));
    const val_ = nodeUtil.inspect(val, { colors: true }).replaceAll("\n", "\n  ");
    console.log(`  ${key_}${val_}`);
  }

  printColored(")");
}
