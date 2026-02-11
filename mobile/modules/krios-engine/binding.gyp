{
  "targets": [
    {
      "target_name": "krios_engine",
      "sources": [
        "cpp/audio/audio_engine.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "cpp/audio"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [ 
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "NAPI_VERSION=8"
      ],
      "conditions": [
        ["OS=='android'", {
          "link_settings": {
            "libraries": [
              "-lOpenSLES",
              "-llog"
            ]
          }
        }],
        ["OS=='ios'", {
          "link_settings": {
            "libraries": [
              "-framework AudioToolbox",
              "-framework AVFoundation"
            ]
          }
        }],
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          }
        }]
      ]
    }
  ]
}
