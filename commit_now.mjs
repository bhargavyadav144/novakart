import git from 'isomorphic-git';
import fs from 'fs';
import path from 'path';

const dir = path.resolve('.');

async function commitChanges() {
  console.log('📦 Checking git status...');
  const files = await git.statusMatrix({ fs, dir });
  let count = 0;
  for (const [filepath, head, workdir, stage] of files) {
    if (workdir !== stage) {
      if (workdir === 0) {
        await git.remove({ fs, dir, filepath });
      } else {
        await git.add({ fs, dir, filepath });
      }
      count++;
    }
  }
  console.log(`Staged ${count} files.`);
  if (count > 0) {
    const sha = await git.commit({
      fs,
      dir,
      author: {
        name: 'bhargavyadav144',
        email: 'bhargavyadav144@users.noreply.github.com'
      },
      message: 'Implement real camera access and photo capture for Delivery Agent KYC verification'
    });
    console.log('✅ Successfully committed changes with SHA:', sha);
  } else {
    console.log('No uncommitted changes detected.');
  }
}

commitChanges().catch(console.error);
