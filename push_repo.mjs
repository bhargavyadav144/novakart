import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'fs';
import path from 'path';

const dir = path.resolve('.');
const token = process.argv[2] || process.env.GITHUB_TOKEN || '';

async function pushToGitHub() {
  console.log('========================================================================');
  console.log('🚀 NOVAKART GITHUB REPOSITORY SYNC');
  console.log('🔗 Target: https://github.com/bhargavyadav144/novakart.git');
  console.log('========================================================================');

  if (!token) {
    console.error('❌ Error: GitHub Personal Access Token (PAT) is required to authenticate.');
    console.log('\n👉 Usage:');
    console.log('   node push_repo.mjs <your-github-token>');
    console.log('   or set GITHUB_TOKEN=<your-token> && node push_repo.mjs');
    console.log('\n🔑 To create a token:');
    console.log('   1. Visit: https://github.com/settings/tokens');
    console.log('   2. Generate a token with "repo" permissions');
    console.log('   3. Run: node push_repo.mjs ghp_xxxxxxxxxxxxxxxxxxxx');
    process.exit(1);
  }

  try {
    console.log('📦 Staging any recent changes...');
    const files = await git.statusMatrix({ fs, dir });
    let stagedCount = 0;
    for (const [filepath, head, workdir, stage] of files) {
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

    // Commit if there are changes
    try {
      const sha = await git.commit({
        fs,
        dir,
        author: {
          name: 'bhargavyadav144',
          email: 'bhargavyadav144@users.noreply.github.com'
        },
        message: 'feat(seller): add fingerprint and face biometric verification for payment requests, settlement disbursals and security settings'
      });
      console.log('🎉 New commit created:', sha);
    } catch {
      console.log('ℹ️ No new changes to commit. Proceeding with existing commits.');
    }

    let pushResult;
    try {
      pushResult = await git.push({
        fs,
        http,
        dir,
        remote: 'origin',
        ref: 'main',
        force: true,
        onAuth: () => ({
          username: token,
          password: ''
        })
      });
    } catch (pushErr) {
      // Retry with username + token
      pushResult = await git.push({
        fs,
        http,
        dir,
        remote: 'origin',
        ref: 'main',
        force: true,
        onAuth: () => ({
          username: 'bhargavyadav144',
          password: token
        })
      });
    }

    console.log('\n========================================================================');
    console.log('✅ SUCCESS: All files successfully pushed to GitHub!');
    console.log('🌐 Repository: https://github.com/bhargavyadav144/novakart');
    console.log('========================================================================');
  } catch (err) {
    console.error('\n❌ Push failed:', err.message);
    if (err.message.includes('401')) {
      console.error('👉 The provided GitHub token was rejected. Please verify the token has "repo" scope and has not expired.');
    }
    process.exit(1);
  }
}

pushToGitHub();
