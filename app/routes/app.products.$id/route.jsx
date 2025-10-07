import { useLoaderData, useNavigate } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  Divider,
  Thumbnail,
  DataTable,
} from "@shopify/polaris";
import { authenticate } from "../../shopify.server";

export async function loader({ request, params }) {
  try {
    const { admin } = await authenticate.admin(request);
    
    if (!params.id) {
      throw new Response("Product ID is required", { status: 400 });
    }
    
    const productId = `gid://shopify/Product/${params.id}`;

    const response = await admin.graphql(
      `#graphql
        query getProduct($id: ID!) {
          product(id: $id) {
            id
            title
            description
            descriptionHtml
            status
            vendor
            productType
            tags
            createdAt
            updatedAt
            featuredImage {
              url
              altText
            }
            images(first: 10) {
              edges {
                node {
                  url
                  altText
                }
              }
            }
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  sku
                  price
                  compareAtPrice
                  inventoryQuantity
                  availableForSale
                  selectedOptions {
                    name
                    value
                  }
                  inventoryItem {
                    measurement {
                      weight {
                        unit
                        value
                      }
                    }
                  }
                }
              }
            }
            totalInventory
          }
        }`,
      {
        variables: { id: productId },
      }
    );

    const data = await response.json();
    
    if (data.errors) {
      console.error("GraphQL errors:", data.errors);
      throw new Response("Failed to fetch product", { status: 500 });
    }
    
    if (!data.data?.product) {
      throw new Response("Product not found", { status: 404 });
    }

    return { product: data.data.product };
  } catch (error) {
    console.error("Loader error:", error);
    
    if (error instanceof Response) {
      throw error;
    }
    
    throw new Response("Internal server error", { status: 500 });
  }
}

export default function ProductDetailsPage() {
  const { product } = useLoaderData();
  const navigate = useNavigate();

  const formatPrice = (price) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "INR",
    }).format(price);
  };

  

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatWeight = (variant) => {
    const weightData = variant.inventoryItem?.measurement?.weight;
    if (weightData?.value) {
      const unit = weightData.unit?.toLowerCase() || '';
      return `${weightData.value} ${unit}`;
    }
    return "—";
  };

  const variantRows = product?.variants.edges.map(({ node }) => [
    node.title,
    node.sku || "—",
    formatPrice(node.price),
    node.compareAtPrice ? formatPrice(node.compareAtPrice) : "—",
    node.inventoryQuantity.toString(),
    node.availableForSale ? "Yes" : "No",
    formatWeight(node),
  ]);

  return (
    <Page
      title={product?.title}
      backAction={{ content: "Back", onAction: () => navigate(-1) }}
      titleMetadata={
        <Badge status={product?.status === "ACTIVE" ? "success" : "warning"}>
          {product?.status}
        </Badge>
      }
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Product Images */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Product Images
                </Text>
                <InlineStack gap="400" wrap>
                  {product?.images.edges.map(({ node }, index) => (
                    <Thumbnail
                      key={index}
                      source={node.url}
                      alt={node.altText || `Product image ${index + 1}`}
                      size="large"
                    />
                  ))}
                  {product?.images.edges.length === 0 && (
                    <Text as="p" tone="subdued">
                      No images available
                    </Text>
                  )}
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Product Information */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Product Information
                </Text>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="span" fontWeight="semibold">
                      Vendor:
                    </Text>
                    <Text as="span">{product?.vendor || "—"}</Text>
                  </InlineStack>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" fontWeight="semibold">
                      Product Type:
                    </Text>
                    <Text as="span">{product?.productType || "—"}</Text>
                  </InlineStack>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" fontWeight="semibold">
                      Total Inventory:
                    </Text>
                    <Badge status={product?.totalInventory > 0 ? "success" : "warning"}>
                      {product?.totalInventory} units
                    </Badge>
                  </InlineStack>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" fontWeight="semibold">
                      Created:
                    </Text>
                    <Text as="span">{formatDate(product?.createdAt)}</Text>
                  </InlineStack>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" fontWeight="semibold">
                      Last Updated:
                    </Text>
                    <Text as="span">{formatDate(product?.updatedAt)}</Text>
                  </InlineStack>
                  {product?.tags && product.tags.length > 0 && (
                    <>
                      <Divider />
                      <BlockStack gap="200">
                        <Text as="span" fontWeight="semibold">
                          Tags:
                        </Text>
                        <InlineStack gap="200" wrap>
                          {product.tags.map((tag, index) => (
                            <Badge key={index}>{tag}</Badge>
                          ))}
                        </InlineStack>
                      </BlockStack>
                    </>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>

            {/* Description */}
            {product?.description && (
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">
                    Description
                  </Text>
                  <Text as="p">{product.description}</Text>
                </BlockStack>
              </Card>
            )}

            {/* Variants */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Variants ({product?.variants.edges.length})
                </Text>
                {product?.variants.edges.length > 0 ? (
                  <DataTable
                    columnContentTypes={[
                      "text",
                      "text",
                      "numeric",
                      "numeric",
                      "numeric",
                      "text",
                      "text",
                    ]}
                    headings={[
                      "Variant",
                      "SKU",
                      "Price",
                      "Compare Price",
                      "Inventory",
                      "Available",
                      "Weight",
                    ]}
                    rows={variantRows}
                  />
                ) : (
                  <Text as="p" tone="subdued">
                    No variants available
                  </Text>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}