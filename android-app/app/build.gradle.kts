import java.io.File
import java.util.Properties

val repoEnv = Properties().apply {
    listOf(
        rootProject.file("../.env.local"),
        rootProject.file("../.env")
    ).forEach { envFile ->
        if (envFile.exists()) {
            envFile.inputStream().use { load(it) }
        }
    }
}

fun repoSecret(name: String): String? = providers.environmentVariable(name).orNull ?: repoEnv.getProperty(name)

fun resolveRepoFile(path: String?): File? {
    if (path.isNullOrBlank()) {
        return null
    }

    val candidate = File(path)
    return if (candidate.isAbsolute) candidate else rootProject.file("../$path")
}

val releaseStoreFile = resolveRepoFile(repoSecret("MAYA_STORE_FILE"))
val releaseStorePassword = repoSecret("MAYA_STORE_PASSWORD")
val releaseKeyAlias = repoSecret("MAYA_KEY_ALIAS") ?: "maya-key"
val releaseKeyPassword = repoSecret("MAYA_KEY_PASSWORD") ?: releaseStorePassword
val hasReleaseSigning = releaseStoreFile?.exists() == true
    && !releaseStorePassword.isNullOrBlank()
    && !releaseKeyAlias.isBlank()
    && !releaseKeyPassword.isNullOrBlank()

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.google.services)
}

android {
    namespace = "com.maya.astrology"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.maya.astrology"
        minSdk = 24
        targetSdk = 35
        versionCode = 4
        versionName = "1.1.2"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            if (hasReleaseSigning) {
                storeFile = releaseStoreFile
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }
    
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    
    kotlinOptions {
        jvmTarget = "17"
    }
    
    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.constraintlayout)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging.ktx)
    
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}
