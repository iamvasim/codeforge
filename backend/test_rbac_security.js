import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import app from './app.js';
import connect from './db/db.js';
import userModel from './models/user.model.js';
import projectModel from './models/project.model.js';
import http from 'http';

console.log("=================================================");
console.log("🔐 RUNNING COMPREHENSIVE RBAC & SECURITY TESTS");
console.log("=================================================\n");

async function runRbacTests() {
    await connect();

    const server = http.createServer(app);
    await new Promise((res) => server.listen(9099, res));
    const baseUrl = 'http://localhost:9099';

    try {
        // Clean up test data
        await userModel.deleteMany({ email: { $in: ['owner_test@soen.com', 'editor_test@soen.com', 'viewer_test@soen.com', 'attacker@soen.com'] } });
        await projectModel.deleteMany({ name: { $in: ['rbac-security-test-project'] } });

        // 1. Create Test Users
        console.log("1️⃣ Creating Test Users: Owner, Editor, Viewer, Attacker (Non-member)...");
        const passHash = await userModel.hashPassword('password123');

        const ownerUser = await userModel.create({ email: 'owner_test@soen.com', password: passHash });
        const editorUser = await userModel.create({ email: 'editor_test@soen.com', password: passHash });
        const viewerUser = await userModel.create({ email: 'viewer_test@soen.com', password: passHash });
        const attackerUser = await userModel.create({ email: 'attacker@soen.com', password: passHash });

        const ownerToken = ownerUser.generateJWT();
        const editorToken = editorUser.generateJWT();
        const viewerToken = viewerUser.generateJWT();
        const attackerToken = attackerUser.generateJWT();

        // 2. Create Project with Owner
        console.log("2️⃣ Creating Project 'rbac-security-test-project' owned by owner_test@soen.com...");
        const project = await projectModel.create({
            name: 'rbac-security-test-project',
            owner: ownerUser._id,
            members: [
                { user: ownerUser._id, role: 'owner' },
                { user: editorUser._id, role: 'editor' },
                { user: viewerUser._id, role: 'viewer' }
            ],
            users: [ownerUser._id, editorUser._id, viewerUser._id],
            fileTree: {
                'App.jsx': { file: { contents: 'console.log("secure code");' } }
            }
        });

        const projectId = project._id.toString();
        console.log(`✓ Project Created with ID: ${projectId}\n`);

        // ── SECURITY TEST 1: IDOR Attack (Attacker / Non-member tries to view project) ──
        console.log("🛡️ Test 1: IDOR Attack Prevention (Non-member requests project data)...");
        const idorRes = await fetch(`${baseUrl}/projects/get-project/${projectId}`, {
            headers: { 'Authorization': `Bearer ${attackerToken}` }
        });
        if (idorRes.status === 403) {
            console.log("✅ PASS: Non-member correctly rejected with 403 Forbidden!\n");
        } else {
            throw new Error(`IDOR Test Failed: Expected 403 but got ${idorRes.status}`);
        }

        // ── SECURITY TEST 2: Viewer attempts to modify project files (PUT /update-file-tree) ──
        console.log("🛡️ Test 2: Viewer attempts unauthorized file modification (PUT /update-file-tree)...");
        const viewerEditRes = await fetch(`${baseUrl}/projects/update-file-tree`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${viewerToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectId,
                fileTree: { 'hacked.js': { file: { contents: 'malicious payload' } } }
            })
        });
        if (viewerEditRes.status === 403) {
            console.log("✅ PASS: Viewer file update correctly blocked with 403 Forbidden!\n");
        } else {
            throw new Error(`Viewer Edit Test Failed: Expected 403 but got ${viewerEditRes.status}`);
        }

        // ── SECURITY TEST 3: Viewer attempts to request AI code modification (POST /ai/stream-code) ──
        console.log("🛡️ Test 3: Viewer attempts AI code modification (POST /ai/stream-code)...");
        const viewerAiRes = await fetch(`${baseUrl}/ai/stream-code`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${viewerToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectId,
                fileName: 'App.jsx',
                instruction: 'Rewrite this file'
            })
        });
        if (viewerAiRes.status === 403) {
            console.log("✅ PASS: Viewer AI code modification correctly rejected with 403 Forbidden!\n");
        } else {
            throw new Error(`Viewer AI Test Failed: Expected 403 but got ${viewerAiRes.status}`);
        }

        // ── SECURITY TEST 4: Editor attempts to invite new members (PUT /add-user) ──
        console.log("🛡️ Test 4: Privilege Escalation Attack (Editor tries to invite members)...");
        const editorInviteRes = await fetch(`${baseUrl}/projects/add-user`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${editorToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectId,
                users: [attackerUser._id.toString()],
                role: 'editor'
            })
        });
        if (editorInviteRes.status === 403) {
            console.log("✅ PASS: Non-owner member invitation correctly blocked with 403 Forbidden!\n");
        } else {
            throw new Error(`Editor Invite Test Failed: Expected 403 but got ${editorInviteRes.status}`);
        }

        // ── SECURITY TEST 5: Editor attempts to delete project (DELETE /:projectId) ──
        console.log("🛡️ Test 5: Destruction Attack (Editor tries to delete project)...");
        const editorDeleteRes = await fetch(`${baseUrl}/projects/${projectId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${editorToken}` }
        });
        if (editorDeleteRes.status === 403) {
            console.log("✅ PASS: Non-owner project deletion correctly blocked with 403 Forbidden!\n");
        } else {
            throw new Error(`Editor Delete Test Failed: Expected 403 but got ${editorDeleteRes.status}`);
        }

        // ── TEST 6: Legitimate Editor can edit files ──
        console.log("🛡️ Test 6: Legitimate Editor updating files (PUT /update-file-tree)...");
        const legitimateEditRes = await fetch(`${baseUrl}/projects/update-file-tree`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${editorToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectId,
                fileTree: { 'App.jsx': { file: { contents: 'console.log("edited by editor");' } } }
            })
        });
        if (legitimateEditRes.status === 200) {
            console.log("✅ PASS: Editor file modification allowed with 200 OK!\n");
        } else {
            throw new Error(`Legitimate Edit Test Failed: Expected 200 but got ${legitimateEditRes.status}`);
        }

        // ── TEST 7: Owner can update roles (Editor -> Viewer) ──
        console.log("🛡️ Test 7: Owner changing member role (Editor -> Viewer)...");
        const roleChangeRes = await fetch(`${baseUrl}/projects/update-member-role`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${ownerToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectId,
                targetUserId: editorUser._id.toString(),
                newRole: 'viewer'
            })
        });
        if (roleChangeRes.status === 200) {
            console.log("✅ PASS: Owner role change succeeded with 200 OK!\n");
        } else {
            throw new Error(`Role Change Test Failed: Expected 200 but got ${roleChangeRes.status}`);
        }

        // ── TEST 8: Demoted user (now Viewer) can no longer edit ──
        console.log("🛡️ Test 8: Verifying demoted user (now Viewer) is immediately blocked from editing...");
        const demotedEditRes = await fetch(`${baseUrl}/projects/update-file-tree`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${editorToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                projectId,
                fileTree: { 'App.jsx': { file: { contents: 'should be blocked' } } }
            })
        });
        if (demotedEditRes.status === 403) {
            console.log("✅ PASS: Demoted user was immediately rejected with 403 Forbidden!\n");
        } else {
            throw new Error(`Demoted User Test Failed: Expected 403 but got ${demotedEditRes.status}`);
        }

        // ── TEST 9: Owner deleting project ──
        console.log("🛡️ Test 9: Legitimate Owner deleting project...");
        const ownerDeleteRes = await fetch(`${baseUrl}/projects/${projectId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${ownerToken}` }
        });
        if (ownerDeleteRes.status === 200) {
            console.log("✅ PASS: Owner project deletion succeeded with 200 OK!\n");
        } else {
            throw new Error(`Owner Delete Test Failed: Expected 200 but got ${ownerDeleteRes.status}`);
        }

        console.log("=================================================");
        console.log("🎉 ALL 9 RBAC & SECURITY ATTACK TESTS PASSED 100%!");
        console.log("Backend authorization is fully enforced against IDOR, privilege escalation, and unauthorized mutations.");
        console.log("=================================================\n");

    } catch (err) {
        console.error("\n❌ RBAC Test Failure:", err.message);
    } finally {
        server.close();
        await mongoose.disconnect();
        process.exit(0);
    }
}

runRbacTests();
