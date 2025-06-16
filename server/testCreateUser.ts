import { storage } from './storage';

async function testCreateUser() {
  try {
    const newUser = await storage.createUser({
      username: 'testuser',
      password: 'testpassword',
      isRepairman: false,
      isAdmin: false,
      isBlocked: false,
    });
    console.log('User created successfully:', newUser);
  } catch (error) {
    console.error('Error creating user:', error);
  }
}

testCreateUser();
