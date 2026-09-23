import {readFile,writeFile} from 'node:fs/promises';

const manifestPath='android/app/src/main/AndroidManifest.xml';
let manifest=await readFile(manifestPath,'utf8');

const permissions=[
  '<uses-permission android:name="android.permission.INTERNET" />',
  '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />'
];

for(const permission of permissions){
  if(!manifest.includes(permission)){
    manifest=manifest.replace('<application',permission+'\n    <application');
  }
}

const cameraFeature='<uses-feature android:name="android.hardware.camera.any" android:required="false" />';
if(!manifest.includes(cameraFeature)){
  manifest=manifest.replace('<application',cameraFeature+'\n    <application');
}

manifest=manifest.replace(
  /android:theme="@style\/AppTheme"/,
  'android:theme="@style/AppTheme" android:screenOrientation="unspecified"'
);

await writeFile(manifestPath,manifest);
console.log('Android manifest prepared for HumanALE camera/microphone/network access.');
