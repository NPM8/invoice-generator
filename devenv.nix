{ pkgs, lib, config, inputs, ... }:

{
  packages = [ pkgs.git ];

  languages.javascript = {
    enable = true;

    bun.enable = true;
    bun.install.enable = true;
  };

  languages.typescript = {
    enable = true;
  };

  services.redis = {
    enable = true;
  };
}
