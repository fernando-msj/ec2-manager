const os = require("os");
const fs = require("fs");
const { inspect } = require("util");

const AWS = require("aws-sdk");
const SSHConfig = require("ssh-config");

const { INSTANCE_STATUS_CODES } = require("./constants");
const { INSTANCE_ID } = require("./auth.json");
const {
  SSH_CONFIG_PATH: SSH_CONFIG_PATH_BASE,
  HOST_NAME_FILE_PATH: HOST_NAME_FILE_PATH_BASE,
  POLL_INTERVAL,
  MAX_POOL_REQUESTS
} = require("./config.json");

const EC2 = new AWS.EC2();

const SSH_CONFIG_PATH = SSH_CONFIG_PATH_BASE.replace("~", os.homedir());
const HOST_NAME_FILE_PATH = HOST_NAME_FILE_PATH_BASE.replace("~", os.homedir());

EC2.describeInstances({ InstanceIds: [INSTANCE_ID] }, (error, result) => {
  if (error) {
    throw error;
  }

  if (result.Reservations.length > 1) {
    console.error("There is more than one Reservations!");
    console.log(inspect(result, true, 9e9, true));
  }

  if (result.Reservations[0].Instances.length > 1) {
    console.error("There is more than one Instances!");
    console.log(inspect(result, true, 9e9, true));
  }

  const instance = result.Reservations[0].Instances[0];

  if (instance.State.Code !== INSTANCE_STATUS_CODES.STOPPED) {
    console.warn(
      "The instance is not on stopped state! Current Status: ",
      instance.State.Name
    );
    return;
  }

  EC2.startInstances(
    {
      InstanceIds: [INSTANCE_ID]
    },
    (error, result) => {
      if (error) {
        throw error;
      }

      if (result.StartingInstances.length > 1) {
        console.warn("There is more than one starting instance!");
        console.log(inspect(result.StartingInstances, true, 9e9, true));
      }

      const mainInstance = result.StartingInstances[0];

      console.log(
        `Switching instance ${mainInstance.InstanceId} from ${mainInstance.PreviousState.Name} to ${mainInstance.CurrentState.Name}`
      );

      let pollCount = 0;

      const intervalID = setInterval(() => {
        pollCount++;

        EC2.describeInstances(
          { InstanceIds: [INSTANCE_ID] },
          (error, result) => {
            if (error) {
              console.warn("Error while querying instance status", error);
            }

            if (pollCount > MAX_POOL_REQUESTS) {
              console.error("Maximum polling limit reached, stopping");
              clearInterval(intervalID);
            }

            if (result.Reservations.length > 1) {
              console.error("There is more than one Reservations!");
              console.log(inspect(result, true, 9e9, true));
            }

            if (result.Reservations[0].Instances.length > 1) {
              console.error("There is more than one Instances!");
              console.log(inspect(result, true, 9e9, true));
            }

            const mainInstance = result.Reservations[0].Instances[0];

            if (!(pollCount % 5)) {
              console.log(
                `Instance ${mainInstance.InstanceId} status: ${mainInstance.State.Name}`
              );
            }

            if (mainInstance.State.Code === INSTANCE_STATUS_CODES.RUNNING) {
              clearInterval(intervalID);

              console.log(
                `Instance ${mainInstance.InstanceId} started successfully!
Running at: ${mainInstance.PublicDnsName}`
              );

              fs.writeFile(
                HOST_NAME_FILE_PATH,
                mainInstance.PublicDnsName,
                error => {
                  if (error) {
                    console.log(
                      "Failed to write host name file",
                      error.code,
                      error.message
                    );
                    return;
                  }
                  console.log(
                    `Updated values in ${HOST_NAME_FILE_PATH} successfully`
                  );
                }
              );

              fs.readFile(SSH_CONFIG_PATH, (error, data) => {
                if (error) {
                  console.error(
                    "Failed to read SSH config",
                    getSystemErrorName(error.code),
                    error.message
                  );

                  return;
                }

                {
                  const parsed = SSHConfig.parse(data.toString());

                  const awsHost = parsed.find(config =>
                    config.value.includes("compute.amazonaws.com")
                  );
                  awsHost.value = mainInstance.PublicDnsName;

                  const hostNameParam = awsHost.config.find(
                    config => config.param === "HostName"
                  );
                  hostNameParam.value = mainInstance.PublicDnsName;

                  const newSSHConfig = parsed.toString();

                  fs.writeFile(SSH_CONFIG_PATH, newSSHConfig, error => {
                    if (error) {
                      console.error(
                        "Failed to save SSH Config",
                        error.code,
                        error.message
                      );
                    }

                    console.log(`Updated values in ${SSH_CONFIG_PATH}`);
                  });
                }
              });
            }
          }
        );
      }, POLL_INTERVAL);
    }
  );
});
