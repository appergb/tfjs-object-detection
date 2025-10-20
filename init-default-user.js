import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

async function initDefaultUser() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'tfjs_detection'
  });

  try {
    // 哈希密码
    const hashedPassword = await bcrypt.hash('198305', 10);
    
    // 插入或更新默认用户
    await connection.execute(
      `INSERT INTO users (id, name, email, password, loginMethod, role, createdAt, lastSignedIn) 
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE 
       password = VALUES(password),
       role = VALUES(role),
       name = VALUES(name)`,
      ['LBX', 'LBX', 'lbx@local.com', hashedPassword, 'local', 'admin']
    );
    
    console.log('✓ 默认用户创建成功');
    console.log('  用户名: LBX');
    console.log('  密码: 198305');
    console.log('  角色: admin');
  } catch (error) {
    console.error('创建默认用户失败:', error);
  } finally {
    await connection.end();
  }
}

initDefaultUser();
