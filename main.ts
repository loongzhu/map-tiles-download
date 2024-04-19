/// <reference lib="deno.ns" />

import { emptyDir } from "https://deno.land/std@0.223.0/fs/mod.ts";
import type { Ora } from "npm:ora";
import ora from "npm:ora";

/**
 * Fetch the tile from the URL
 * @param params The tile coordinates
 * @returns {string} The tile URL
 */
const getURL = ({ x, y, z }: { [key: string]: number }): string =>
  url.replace("{x}", x.toString()).replace("{y}", y.toString()).replace(
    "{z}",
    z.toString(),
  );

/**
 * Encode the string to Uint8Array
 * @param string The string to encode
 * @returns Uint8Array
 */
const encode = (string = "") => {
  const encoder = new TextEncoder();
  const data = encoder.encode(string);
  return data;
};

/**
 * Check if the directory exists, if not create it
 * @param z The z coordinate
 * @param x The x coordinate
 */
const checkDir = async ({ z, x }: { z: number; x: number }) => {
  if (!await Deno.stat(`${path}/${z}`).catch(() => false)) {
    await Deno.mkdir(`${path}/${z}`);
  }

  if (!await Deno.stat(`${path}/${z}/${x}`).catch(() => false)) {
    await Deno.mkdir(`${path}/${z}/${x}`);
  }
};

/**
 * Download the tile
 * @param x The x coordinate
 * @param y The y coordinate
 * @param z The z coordinate
 * @param index The index of the tile
 * @param count Total number of tiles
 */
const download = (
  { x, y, z }: { [key: string]: number },
  index: number,
  count: number,
) => {
  // deno-lint-ignore no-async-promise-executor
  return new Promise<void>(async (resolve, reject) => {
    const spinner: Ora = ora(`Download... ${index}/${count}`).start();

    const url = getURL({ x, y, z });
    const response = await fetch(url);

    if (response.status !== 200) {
      await errorlog(spinner, { x, y, z });
      reject();
      return;
    }

    await checkDir({ z, x });

    const blob = await response.blob();

    await Deno.writeFile(`${path}/${z}/${x}/${y}.png`, blob.stream());

    spinner.succeed(
      `${new Date().toString()} successful: { z: ${z}, x: ${x}, y: ${y} }`,
    );

    resolve();
  }).catch(() => {});
};

/**
 * Log the error to error.log file
 * @param spinner The spinner instance
 * @param params The tile coordinates
 * @param reject The reject function
 */
const errorlog = async (
  spinner: Ora,
  { x, y, z }: { [key: string]: number },
) => {
  const error = `${
    new Date().toString()
  } failed: { z: ${z}, x: ${x}, y: ${y} }.`;
  const data = encode(`${error}\n`);

  const file = await Deno.open("error.log", { write: true });
  Deno.writeFile("error.log", data, { append: true });
  file.close();

  spinner.fail(error);
};

/**
 * Clear the tiles folder and error.log file
 */
const clear = async () => {
  const spinner = ora("clear...").start();
  await emptyDir(`${path}`);

  await Deno.writeFile("error.log", encode());
  spinner.succeed(`${new Date().toString()}clear successful`);
};

/**
 * Download all tiles in batches
 * @param tasks Array of all tasks
 * @param batchSize Number of tasks to download in parallel
 */
async function _downloadInBatches(
  tasks: Array<{ [key: string]: number }>,
  batchSize: number = 1,
) {
  let i = 0;
  while (i < tasks.length) {
    const batch = tasks.slice(i, i + batchSize);
    const promises = batch.map((task) => download(task, i, tasks.length));
    await Promise.allSettled(promises);
    i += batchSize;
  }
}

/**
 * Main function
 */
const main = async () => {
  const old = new Date().getTime();

  await clear();

  // const tasks = [];
  for (let _z = minz; _z <= z; _z++) {
    for (let _x = 0; _x < Math.pow(2, _z); _x++) {
      for (let _y = 0; _y < Math.pow(2, _z); _y++) {
        // tasks.push({ x: _x, y: _y, z: _z });
        await download({ x: _x, y: _y, z: _z }, _y, Math.pow(2, _z));
      }
    }
  }

  // await _downloadInBatches(tasks, 5);

  const newTime = new Date().getTime();

  const milliseconds = newTime - old;

  let seconds, minutes, hours;

  seconds = milliseconds / 1000;

  if (seconds > 60) {
    minutes = seconds / 60;
    seconds = seconds % 60;
  }

  if (minutes && minutes > 60) {
    hours = minutes / 60;
    minutes = minutes % 60;
  }

  const timelog = `${hours ? hours.toFixed(0) + "h " : ""}${
    minutes ? minutes.toFixed(0) + "min " : ""
  }${seconds.toFixed(1)}s`;

  ora().succeed(`Download completed in ${timelog}`);
};

/**
 * Max Zoom level
 * @description You can change the value to download the tiles from 0 to z zoom level
 * @description For example, you can change the value to 18 to download the tiles from 0 to 18 zoom level (leaflet default max zoom level)
 * @type {number}
 * @default 18
 */
const z: number = 18;

/**
 * Min Zoom level
 * @description Set the minimum zoom level and download the tiles from the min zoom level to the max zoom level
 * @default 0
 */
const minz: number = 0;

/**
 * Path to save the tiles
 */
const path = "tiles8";

/**
 * URL to download the tiles
 * @description You can change the URL to download the tiles from different sources
 * @description For example, you can use the URL below to download the tiles from the OpenStreetMap server (leaflet map tiles server)
 * @type {string}
 * @default "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
 */
const url: string = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

main();
