/**
 * Every video keeps its own files in assets/projects/<name>/ (footage, screenshots, processed,
 * cutouts, audio). Use the helper so a video can never pick up another video's assets:
 *
 *   const asset = projectAssets('my-first-video');
 *   staticFile(asset('footage/talk-original.mp4'))
 *
 * Shared brand files (fonts, logos) stay at the top of assets/ and are referenced directly.
 */
export const projectAssets =
  (project: string) =>
  (path: string): string =>
    `projects/${project}/${path}`;
