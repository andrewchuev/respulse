package online.respulse.app

import android.app.Activity
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.security.KeyStore
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

@InvokeArg
class VaultArgs {
    lateinit var data: String
}

/**
 * Seals the SSH vault with a non-exportable AES-256-GCM key held by the Android Keystore.
 * The key never leaves secure hardware where available; Rust only ever sees ciphertext.
 */
@TauriPlugin
class VaultPlugin(activity: Activity) : Plugin(activity) {
    private val keyStore: KeyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }

    @Command
    fun seal(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(VaultArgs::class.java)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
            // The Keystore picks a fresh random IV; it is stored in front of the ciphertext.
            val sealed = cipher.iv + cipher.doFinal(Base64.decode(args.data, Base64.NO_WRAP))
            invoke.resolve(JSObject().put("data", Base64.encodeToString(sealed, Base64.NO_WRAP)))
        } catch (e: Exception) {
            invoke.reject("Failed to seal vault: ${e.message}", "unavailable", e)
        }
    }

    @Command
    fun open(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(VaultArgs::class.java)
            val sealed = Base64.decode(args.data, Base64.NO_WRAP)
            if (sealed.size <= IV_LENGTH) {
                invoke.reject("Vault data truncated", "unrecoverable")
                return
            }
            val key = existingKey()
            if (key == null) {
                invoke.reject("Keystore key missing", "unrecoverable")
                return
            }
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_BITS, sealed, 0, IV_LENGTH))
            val plain = cipher.doFinal(sealed, IV_LENGTH, sealed.size - IV_LENGTH)
            invoke.resolve(JSObject().put("data", Base64.encodeToString(plain, Base64.NO_WRAP)))
        } catch (e: Exception) {
            // Tampered data or an invalidated key can never be decrypted again; anything else may be transient.
            val permanent = e is AEADBadTagException || e is KeyPermanentlyInvalidatedException
            invoke.reject("Failed to open vault: ${e.message}", if (permanent) "unrecoverable" else "unavailable", e)
        }
    }

    private fun existingKey(): SecretKey? = keyStore.getKey(KEY_ALIAS, null) as? SecretKey

    private fun getOrCreateKey(): SecretKey {
        existingKey()?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return generator.generateKey()
    }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val KEY_ALIAS = "respulse_ssh_vault_v1"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_LENGTH = 12
        const val TAG_BITS = 128
    }
}
