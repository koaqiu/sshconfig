# sshconfig
Config SSH Clinet Host

一个同步SSH客户端主机配置（`~/.ssh/config`）到云端（目前只支持阿里云的OSS）的工具。

默认保存在`oss://<bucket>/appdata/sshconfig/`，记得把这个资源设置为**私有**

因为配置信息和密钥是上传到自己的oss里面安全信有保证（一定程度上）所以没有另外加密处理

```
sshcfg <command> [options]
版本： 1.0.0
命令：
  show                  显示ssh config配置信息
  get <name>            从云端下载 config配置信息
  put <name>            上传ssh config配置信息到云端
  test                  测试OSS设置是否成功
参数：
  -H, --help <boolean>        显示帮助 默认值：false
  --oss-config <file>         OSS配置文件，JSON文件 默认值："C:\Users\Qiu\.ssh\ossconfig.json"
  --accessKeyId <string>      oss accessKeyId
  --accessKeySecret <string>  oss accessKeySecret
  --bucket <string>           oss bucket
  --region <string>           oss region
  --save <boolean>            保存OSS设置 默认值：false
  ```
  
  阿里云OSS的开通配置请参考OSS的官方文档
  * [开始使用阿里云OSS](https://help.aliyun.com/document_detail/31883.html?spm=a2c4g.11186623.2.10.5577639cgdKlQR)
  * [RAM子账号](https://help.aliyun.com/document_detail/100602.html?spm=a2c4g.11174283.6.625.4b917da2N1rMtw)
  
