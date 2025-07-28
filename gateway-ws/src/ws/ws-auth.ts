// //ws-auth.ts
import axios from "axios";

export async function handleAuth(message: any, socket: WebSocket) {
  try {
    const { token, userId } = message;
    // console.log("🧪 Token auth request:", { token, userId });

    const isValid = await validateTokenWS(token, userId);

    if (!isValid) {
      socket.send(JSON.stringify({
        type: "auth:error",
        message: "Invalid token"
      }));
      return { success: false, userId: null };
    }

    socket.send(JSON.stringify({
      type: "auth:success",
      userId
    }));

    return { success: true, userId };
  } catch (err) {
    console.error("🧱 WS Auth Error:", err);
    socket.send(JSON.stringify({
      type: "auth:error",
      message: "Authentication failed"
    }));
    return { success: false, userId: null };
  }
}

export async function validateTokenWS(token: string, userId: number): Promise<boolean> {
  try {
    const res = await axios.post("http://security:4003/validate-token", {
      token,
      userId,
    });

    return res.data.success === true;
  } catch (err) {
    console.error("❌ Error validating token with security service:", err);
    return false;
  }
}