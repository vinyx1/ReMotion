# usb-serial-for-android finds each driver's supported devices by reflection
# (ProbeTable calls the static getSupportedDevices()), so keep its drivers whole.
-keep class com.hoho.android.usbserial.driver.** { *; }

# Google's code scanner (ML Kit) also builds its parts by reflection (MlKitInitProvider
# instantiates its ComponentRegistrars); shrinking them crashed "Scan the code".
-keep class com.google.mlkit.** { *; }
-keep class * implements com.google.firebase.components.ComponentRegistrar { <init>(); }
