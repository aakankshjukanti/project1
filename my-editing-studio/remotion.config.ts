import {Config} from '@remotion/cli/config';

Config.setEntryPoint('./src/index.ts');
// Everything in assets/ is reachable with staticFile('footage/clip.mp4') etc.
Config.setPublicDir('./assets');
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
