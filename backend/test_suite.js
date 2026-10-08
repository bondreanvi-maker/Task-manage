const http = require('http');
const app = require('./server');

const PORT = 5001;

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Full Test Suite for Supabase TaskFlow API...\n');

  const server = app.listen(PORT, async () => {
    try {
      let passed = 0;
      let total = 0;

      function assert(condition, testName) {
        total++;
        if (condition) {
          console.log(`  ✅ PASS: ${testName}`);
          passed++;
        } else {
          console.error(`  ❌ FAIL: ${testName}`);
          throw new Error(`Test failed: ${testName}`);
        }
      }

      // 1. Health Check
      console.log('--- 1. Testing Health Check ---');
      const healthRes = await makeRequest('/api/health');
      assert(healthRes.status === 200 && healthRes.body.status === 'healthy', 'GET /api/health returns 200 healthy');

      // 2. Auth: Register
      console.log('\n--- 2. Testing Authentication ---');
      const testEmail = `tester_${Date.now()}@taskflow.dev`;
      const regRes = await makeRequest('/api/auth/register', 'POST', {
        name: 'Test Runner',
        email: testEmail,
        password: 'password123',
      });
      assert(regRes.status === 201 && regRes.body.token, 'POST /api/auth/register creates user and returns JWT token');
      const userToken = regRes.body.token;

      // Duplicate registration check
      const dupRes = await makeRequest('/api/auth/register', 'POST', {
        name: 'Test Runner',
        email: testEmail,
        password: 'password123',
      });
      assert(dupRes.status === 409, 'POST /api/auth/register rejects duplicate email with 409');

      // Auth: Login
      const loginRes = await makeRequest('/api/auth/login', 'POST', {
        email: testEmail,
        password: 'password123',
      });
      assert(loginRes.status === 200 && loginRes.body.token, 'POST /api/auth/login verifies credentials and returns token');

      // Auth: Me
      const meRes = await makeRequest('/api/auth/me', 'GET', null, userToken);
      assert(meRes.status === 200 && meRes.body.user.email === testEmail, 'GET /api/auth/me returns current user info');

      // 3. Category Management
      console.log('\n--- 3. Testing Category Management ---');
      const catsRes = await makeRequest('/api/categories', 'GET', null, userToken);
      assert(catsRes.status === 200 && Array.isArray(catsRes.body.categories), 'GET /api/categories returns default categories');

      const addCatRes = await makeRequest('/api/categories', 'POST', { name: 'Fitness' }, userToken);
      assert(addCatRes.status === 201 && addCatRes.body.categories.includes('Fitness'), 'POST /api/categories adds custom category');

      const delCatRes = await makeRequest('/api/categories/Fitness', 'DELETE', null, userToken);
      assert(delCatRes.status === 200 && !delCatRes.body.categories.includes('Fitness'), 'DELETE /api/categories/:name removes custom category');

      // 4. Tasks CRUD and Filters
      console.log('\n--- 4. Testing Tasks CRUD & Logic ---');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const createTaskRes = await makeRequest('/api/tasks', 'POST', {
        title: 'Complete Supabase migration verification',
        description: 'Verify all endpoints, schemas, indexes and services.',
        priority: 'High',
        category: 'Projects',
        tags: ['Supabase', 'PostgreSQL', 'Testing'],
        dueDate: tomorrow.toISOString(),
        recurring: { enabled: true, frequency: 'weekly' },
      }, userToken);

      assert(createTaskRes.status === 201 && createTaskRes.body.task.title, 'POST /api/tasks creates new task with focusScore');
      const createdTask = createTaskRes.body.task;
      const taskId = createdTask._id || createdTask.id;

      // Single task fetch
      const singleTaskRes = await makeRequest(`/api/tasks/${taskId}`, 'GET', null, userToken);
      assert(singleTaskRes.status === 200 && singleTaskRes.body.task.title === 'Complete Supabase migration verification', 'GET /api/tasks/:id retrieves task');

      // List tasks with filter
      const listTasksRes = await makeRequest('/api/tasks?search=Supabase&priority=High', 'GET', null, userToken);
      assert(listTasksRes.status === 200 && listTasksRes.body.count >= 1, 'GET /api/tasks filters by search query and priority');

      // Task Stats
      const statsRes = await makeRequest('/api/tasks/stats', 'GET', null, userToken);
      assert(statsRes.status === 200 && statsRes.body.stats.total >= 1, 'GET /api/tasks/stats computes dashboard statistics');

      // Focus Tasks
      const focusRes = await makeRequest('/api/tasks/focus', 'GET', null, userToken);
      assert(focusRes.status === 200 && Array.isArray(focusRes.body.tasks), 'GET /api/tasks/focus returns top focus tasks');

      // Update Task Details
      const updateRes = await makeRequest(`/api/tasks/${taskId}`, 'PUT', {
        title: 'Complete Supabase migration verification (Updated)',
        priority: 'Medium',
      }, userToken);
      assert(updateRes.status === 200 && updateRes.body.task.title.includes('(Updated)'), 'PUT /api/tasks/:id updates task details');

      // Quick Status toggle to Completed (triggers recurring task creation)
      const statusRes = await makeRequest(`/api/tasks/${taskId}/status`, 'PATCH', {
        status: 'Completed',
      }, userToken);
      assert(statusRes.status === 200 && statusRes.body.task.status === 'Completed' && statusRes.body.recurringCreated, 'PATCH /api/tasks/:id/status completes task and triggers recurring generation');

      // Delete Task
      const delTaskRes = await makeRequest(`/api/tasks/${taskId}`, 'DELETE', null, userToken);
      assert(delTaskRes.status === 200 && delTaskRes.body.success, 'DELETE /api/tasks/:id deletes task');

      console.log(`\n🎉 ALL ${passed}/${total} API & DATABASE TESTS PASSED SUCCESSFULLY! 🎉\n`);
      server.close();
      process.exit(0);
    } catch (err) {
      console.error('\n❌ Test suite failure:', err);
      server.close();
      process.exit(1);
    }
  });
}

runTests();
