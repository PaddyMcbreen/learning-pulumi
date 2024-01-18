import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const config = new pulumi.Config()

interface vpc {
    vpc_name: string;
    vpc_cidr: string;
    azs: string[];
    pub_sub_cidrs: string[];
    priv_sub_cidrs: string[];
}


interface yourDetails {
    yourIP: string;
    yourAccessKey: string;
}




// define objects from config file
const vpc = config.requireObject<vpc>("vpc")


// ----NETWORKING----
// create VPC
const main = new aws.ec2.Vpc("main-vpc", {
    cidrBlock: vpc.vpc_cidr,
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: {
        Name: `${pulumi.getProject()}-${vpc.vpc_name}`,
        ManagedBy: "Pulumi"
    }
})



// exports:
export const vpc_export = main