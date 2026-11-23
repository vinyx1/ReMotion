package ca.remotion.phone

import android.content.Context
import android.net.Uri
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
  Who this phone is signed in as: one patient on one dashboard, from the code on that patient's
  Profile & settings page (server/api.ts, /api/phone/pair). The token goes with every upload; the
  server decides the account and patient from it. Kept in the app's own settings.
*/
data class Login(
    val server: String,          // e.g. https://remotion.up.railway.app (from the QR code), or the typed-code server
    val token: String,
    val patientId: String,
    val patientName: String,
    val demo: Boolean,           // signed in to a 1-hour demo account
    val expiresAt: Long?,        // when a demo ends (ms since 1970); null for a real account
) {
    val firstName get() = patientName.substringBefore(' ')
}

/** A failed sign-in, in words for the patient. */
class SignInError(message: String) : Exception(message)

object Account {
    private const val PREFS = "login"

    fun load(context: Context): Login? {
        val p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val token = p.getString("token", null) ?: return null
        return Login(
            server = p.getString("server", "")!!, token = token,
            patientId = p.getString("patientId", "")!!, patientName = p.getString("patientName", "")!!,
            demo = p.getBoolean("demo", false), expiresAt = p.getLong("expiresAt", 0).takeIf { it > 0 },
        )
    }

    fun save(context: Context, l: Login) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("server", l.server).putString("token", l.token)
            .putString("patientId", l.patientId).putString("patientName", l.patientName)
            .putBoolean("demo", l.demo).putLong("expiresAt", l.expiresAt ?: 0)
            .apply()
    }

    fun clear(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()

    /**
      What a scanned QR code or an app link holds: the dashboard's address and the code.
      Accepts https://<server>/pair?code=ABC123 (the QR code), remotion://pair?code=…&server=…
      (the /pair page's button), or a bare code (then the given server).
    */
    fun parse(text: String, fallbackServer: String): Pair<String, String>? {
        val t = text.trim()
        val uri = runCatching { Uri.parse(t) }.getOrNull()
        val code = uri?.getQueryParameter("code")
        return when {
            uri?.scheme == "remotion" && code != null -> (uri.getQueryParameter("server") ?: fallbackServer) to code
            (uri?.scheme == "http" || uri?.scheme == "https") && code != null ->
                "${uri.scheme}://${uri.authority}" to code
            t.replace(" ", "").matches(Regex("[A-Za-z0-9]{6}")) -> fallbackServer to t
            else -> null
        }
    }

    /** Swap a code for this phone's sign-in. Runs on a background thread. */
    fun pair(server: String, code: String): Login {
        val base = server.trim().trimEnd('/')
        val (status, body) = request("$base/api/phone/pair", "POST", null, JSONObject().put("code", code).toString())
        if (status != 200) throw SignInError(body.optString("error").ifEmpty { "The dashboard answered $status." })
        val patient = body.getJSONObject("patient")
        return Login(
            server = base, token = body.getString("token"),
            patientId = patient.getString("id"), patientName = patient.getString("name"),
            demo = body.optString("kind") == "demo",
            expiresAt = if (body.isNull("expiresAt")) null else body.getLong("expiresAt"),
        )
    }

    /** Is this sign-in still good? true, false (it ended: a demo's hour is up, or the patient was deleted), or null (can't tell: offline). */
    fun stillSignedIn(l: Login): Boolean? = try {
        when (request("${l.server}/api/phone/me", "GET", l.token, null).first) {
            200 -> true
            401 -> false
            else -> null
        }
    } catch (_: Exception) {
        null
    }

    fun signOut(l: Login) {
        runCatching { request("${l.server}/api/phone/logout", "POST", l.token, "{}") }
    }

    private fun request(url: String, method: String, token: String?, body: String?): Pair<Int, JSONObject> {
        val c = try {
            URL(url).openConnection() as HttpURLConnection
        } catch (e: Exception) {
            throw SignInError("“$url” isn’t a web address.")
        }
        try {
            c.requestMethod = method
            c.connectTimeout = 5000
            c.readTimeout = 8000
            if (token != null) c.setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json")
                c.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = try { c.responseCode } catch (e: Exception) {
                throw SignInError("The phone can’t reach the dashboard. Check the internet connection.")
            }
            val text = (if (status < 400) c.inputStream else c.errorStream)?.bufferedReader()?.readText().orEmpty()
            return status to (runCatching { JSONObject(text) }.getOrNull() ?: JSONObject())
        } finally {
            c.disconnect()
        }
    }
}
