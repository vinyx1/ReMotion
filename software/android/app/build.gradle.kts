plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "ca.remotion.phone"
    // 37.2: the current Compose libraries need Android 37.1 or later to compile against
    compileSdk {
        version = release(37) { minorApiLevel = 2 }
    }

    defaultConfig {
        applicationId = "ca.remotion.phone"
        minSdk = 26
        targetSdk = 37
        // CI (.github/workflows/android.yml) passes a higher number every build, so phones accept it as an update
        versionCode = providers.environmentVariable("APP_VERSION_CODE").orNull?.toInt() ?: 1
        versionName = providers.environmentVariable("APP_VERSION_NAME").orNull ?: "0.1"
    }

    // The release key lives only in GitHub secrets (and a team backup), never in the repo.
    // Every published APK must be signed with it, or phones refuse it as an update.
    val keystore = providers.environmentVariable("REMOTION_KEYSTORE").orNull
    signingConfigs {
        if (keystore != null) {
            create("release") {
                storeFile = file(keystore)
                storePassword = providers.environmentVariable("REMOTION_KEYSTORE_PASSWORD").get()
                keyAlias = providers.environmentVariable("REMOTION_KEY_ALIAS").get()
                keyPassword = providers.environmentVariable("REMOTION_KEYSTORE_PASSWORD").get()
            }
        }
    }

    buildFeatures {
        compose = true
    }

    buildTypes {
        // The build to put on a phone: Compose runs much faster optimised than in a debug build.
        // Signed with the release key in CI; on a laptop without it, with the debug key so
        // `./gradlew installRelease` still works (but won't install over a downloaded release).
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.11.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.core:core-ktx:1.19.1")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.11.1")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.11.1")

    // USB serial (CDC-ACM) for the Arduino: https://github.com/mik3y/usb-serial-for-android
    implementation("com.github.mik3y:usb-serial-for-android:3.12.0")

    // Scanning the QR code on a patient's profile (Google's scanner: no camera permission, works on any Play phone)
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
}
