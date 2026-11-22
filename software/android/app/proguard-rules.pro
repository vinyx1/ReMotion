# usb-serial-for-android finds each driver's supported devices by reflection
# (ProbeTable calls the static getSupportedDevices()), so keep its drivers whole.
-keep class com.hoho.android.usbserial.driver.** { *; }
