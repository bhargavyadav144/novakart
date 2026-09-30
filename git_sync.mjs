import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'fs';
import path from 'path';

const dir = path.resolve('.');

async function run() {
  console.log('📦 Initializing / verifying git repository...');
  try {
    await git.init({ fs, dir });
  } catch (e) {
    console.log('Init note:', e.message);
  }

  // Set remote origin
  const remoteUrl = 'https://github.com/bhargavyadav144/novakart.git';
  try {
    const remotes = await git.listRemotes({ fs, dir });
    const exists = remotes.find(r => r.remote === 'origin');
    if (!exists) {
      await git.addRemote({ fs, dir, remote: 'origin', url: remoteUrl });
      console.log('🔗 Added remote origin:', remoteUrl);
    } else {
      console.log('🔗 Remote origin already configured:', exists.url);
    }
  } catch (e) {
    console.error('Remote error:', e.message);
  }

  // Get status of all files
  console.log('🔍 Checking file status against .gitignore...');
  const files = await git.statusMatrix({ fs, dir });
  console.log(`Found ${files.length} tracked/untracked items.`);

  let stagedCount = 0;
  for (const [filepath, head, workdir, stage] of files) {
    // If modified or untracked
    if (workdir !== stage) {
      if (workdir === 0) {
        await git.remove({ fs, dir, filepath });
      } else {
        await git.add({ fs, dir, filepath });
      }
      stagedCount++;
    }
  }

  console.log(`✅ Staged ${stagedCount} files.`);

  // Create commit
  try {
    const sha = await git.commit({
      fs,
      dir,
      author: {
        name: 'Bhargav Yadav',
        email: 'bhargavyadav144@users.noreply.github.com'
      },
      message: 'Initial release: NovaKart Multi-Vendor E-Commerce Platform with 7 portals and unified backend'
    });
    console.log('🎉 Successfully committed! Commit SHA:', sha);
  } catch (err) {
    console.log('Commit note:', err.message);
  }
}

run();
