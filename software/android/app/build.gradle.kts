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
        versionCode = 1
        versionName = "0.1"
    }

    buildFeatures {
        compose = true
    }
}

/*
  Demo mode plays the repo's sample session (data/sample/fake_session.txt) as if it came
  from the device. It's copied into the app's assets at build time, so there is one copy
  in git and the app always has the current one.
*/
abstract class CopyDemoSession : DefaultTask() {
    @get:InputFile abstract val session: RegularFileProperty
    @get:OutputDirectory abstract val outDir: DirectoryProperty

    @TaskAction
    fun copy() {
        val out = outDir.get().asFile
        out.mkdirs()
        session.get().asFile.copyTo(out.resolve("fake_session.txt"), overwrite = true)
    }
}

val copyDemoSession = tasks.register<CopyDemoSession>("copyDemoSession") {
    session.set(rootProject.layout.projectDirectory.file("../../data/sample/fake_session.txt"))
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(copyDemoSession, CopyDemoSession::outDir)
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

    testImplementation("junit:junit:4.13.2")
}
