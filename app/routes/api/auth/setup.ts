import type { Route } from "./+types/setup";
import { createUser, hasAdminUser } from "~/services/user-store.server";
import { isValidEmail, isValidPassword, addLoginDelay, toPublicUser, getClientIP } from "~/utils/auth.server";
import { createSession, serializeCookie, getCookieOptions, COOKIE_NAME } from "~/services/session-store.server";
import type { SetupFormData, SetupResponse } from "~/types/auth";

export async function loader(): Promise<Response> {
  // Check if admin already exists
  const adminExists = await hasAdminUser();
  
  const response: SetupResponse = {
    success: true,
    needsSetup: !adminExists
  };
  
  return Response.json(response);
}

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 }
    );
  }
  
  try {
    // Check if admin already exists
    const adminExists = await hasAdminUser();
    if (adminExists) {
      return Response.json(
        { success: false, error: 'Admin user already exists' },
        { status: 400 }
      );
    }
    
    // Parse request data
    const formData = await request.json();
    const { email, password } = formData;
    
    // Validate input values
    if (!email || !password) {
      return Response.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    // Email validation check
    if (!isValidEmail(email)) {
      return Response.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }
    
    // Password strength check
    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      return Response.json(
        { success: false, error: passwordValidation.errors.join(', ') },
        { status: 400 }
      );
    }
    
    // Create admin account
    const newUser = await createUser({
      email,
      password,
      role: 'admin'
    });
    
    console.log(`✅ Admin user created: ${newUser.email} (${newUser.id})`);
    
    // Extract User-Agent and IP address
    const userAgent = request.headers.get('User-Agent') || undefined;
    const ipAddress = getClientIP(request);
    
    // Create new session (auto login)
    const session = await createSession(newUser.id, userAgent, ipAddress);
    
    // Set cookie
    const cookieOptions = getCookieOptions();
    const cookieString = serializeCookie(COOKIE_NAME, session.id, cookieOptions);
    
    // Return JSON response (with cookie)
    return Response.json(
      { 
        success: true, 
        user: toPublicUser(newUser)
      },
      {
        headers: {
          'Set-Cookie': cookieString,
        },
      }
    );
    
  } catch (error) {
    console.error('Setup error:', error);
    
    // Add delay (security)
    await addLoginDelay();
    
    if (error instanceof Error) {
      return Response.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    
    return Response.json(
      { success: false, error: 'Failed to create admin user' },
      { status: 500 }
    );
  }
}